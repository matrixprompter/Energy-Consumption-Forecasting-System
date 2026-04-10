"""
P2-207: FastAPI Endpoints
POST /forecast, GET /latest-forecast, GET /model-comparison,
GET /feature-importance, POST /update-data, GET /health
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL
from data_collector import collect_data
from feature_engineering import create_features, get_feature_columns
from models import ProphetForecaster, SARIMAForecaster, XGBoostForecaster

# ---------------------------------------------------------------------------
# Modelleri başlangıçta yükle
# ---------------------------------------------------------------------------
prophet = ProphetForecaster()
xgboost_model = XGBoostForecaster()
sarima = SARIMAForecaster()
loaded_models: list[str] = []

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama başlangıcında modelleri yükle."""
    global loaded_models
    for name, model in [("prophet", prophet), ("xgboost", xgboost_model), ("sarima", sarima)]:
        try:
            model._load_model()
            loaded_models.append(name)
            print(f"  {name} modeli yüklendi.")
        except FileNotFoundError:
            print(f"  {name} modeli bulunamadı — eğitim gerekli.")
    yield


app = FastAPI(
    title="Enerji Tüketim Tahmin API",
    description="Prophet, XGBoost ve SARIMA modelleri ile saatlik enerji tüketim tahmini",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic Modelleri
# ---------------------------------------------------------------------------
class ForecastRequest(BaseModel):
    model: str = "xgboost"  # prophet / xgboost / sarima
    horizon: int = 24  # 24 / 48 / 168
    region: str = "TR"


class UpdateDataRequest(BaseModel):
    from_date: str  # ISO format
    to_date: str


class ScenarioRequest(BaseModel):
    temp: float = 20.0
    is_holiday: bool = False
    hour: int = 12
    day_of_week: int = 2


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    """Servis sağlık kontrolü."""
    return {
        "status": "healthy",
        "models_loaded": loaded_models,
    }


@app.post("/forecast")
async def forecast(req: ForecastRequest) -> dict[str, Any]:
    """Zaman serisi tahmini üretir."""
    if req.model not in ("prophet", "xgboost", "sarima"):
        raise HTTPException(400, f"Geçersiz model: {req.model}")

    if req.model not in loaded_models:
        raise HTTPException(503, f"{req.model} modeli henüz eğitilmemiş.")

    try:
        if req.model == "prophet":
            predictions = prophet.predict(horizon=req.horizon)
        elif req.model == "sarima":
            predictions = sarima.predict(horizon=req.horizon)
        else:
            # XGBoost için son verilerden özellik üret
            response = (
                supabase.table("energy_readings")
                .select("*")
                .order("timestamp", desc=True)
                .limit(200)
                .execute()
            )
            import pandas as pd

            df = pd.DataFrame(response.data)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp").reset_index(drop=True)
            df_feat = create_features(df)
            features = get_feature_columns()
            last_row = df_feat.iloc[-1][features]

            predictions = []
            for h in range(req.horizon):
                pred = xgboost_model.predict(pd.DataFrame([last_row]))[0]
                predictions.append(
                    {
                        "timestamp": "",
                        "value": round(float(pred), 2),
                        "lower": round(float(pred * 0.95), 2),
                        "upper": round(float(pred * 1.05), 2),
                    }
                )

        # Son MAPE değerini al
        last_forecast = (
            supabase.table("forecasts")
            .select("mape")
            .eq("model_name", req.model)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        mape = last_forecast.data[0]["mape"] if last_forecast.data else None

        return {
            "predictions": predictions,
            "confidence": {
                "lower": [p["lower"] for p in predictions],
                "upper": [p["upper"] for p in predictions],
            },
            "mape": mape,
        }
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/latest-forecast")
async def latest_forecast(
    model: str = Query(default="xgboost"),
    region: str = Query(default="TR"),
) -> dict[str, Any]:
    """En son tahmin sonuçlarını getirir."""
    response = (
        supabase.table("forecasts")
        .select("*")
        .eq("model_name", model)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(404, f"{model} için tahmin bulunamadı.")

    row = response.data[0]
    return {
        "forecast": row["predictions"],
        "generated_at": row["created_at"],
        "mape": row["mape"],
        "rmse": row["rmse"],
        "mae": row["mae"],
    }


@app.get("/model-comparison")
async def model_comparison() -> dict[str, Any]:
    """3 modelin metrik karşılaştırması."""
    response = (
        supabase.table("model_comparisons")
        .select("*")
        .order("run_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(404, "Henüz model karşılaştırması yapılmamış.")

    row = response.data[0]

    # Her model için en son forecasts tablosundan detaylı metrikler
    result: dict[str, Any] = {}
    for model_name in ["prophet", "xgboost", "sarima"]:
        f_resp = (
            supabase.table("forecasts")
            .select("mape, rmse, mae")
            .eq("model_name", model_name)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if f_resp.data:
            result[model_name] = f_resp.data[0]
        else:
            result[model_name] = {
                "mape": row.get(f"{model_name}_mape"),
                "rmse": None,
                "mae": None,
            }

    result["winner"] = row["winner"]
    return result


@app.get("/feature-importance")
async def feature_importance() -> dict[str, Any]:
    """XGBoost SHAP değerleri."""
    if "xgboost" not in loaded_models:
        raise HTTPException(503, "XGBoost modeli yüklenmemiş.")

    try:
        # Son verilerden SHAP hesapla
        response = (
            supabase.table("energy_readings")
            .select("*")
            .order("timestamp", desc=True)
            .limit(500)
            .execute()
        )
        import pandas as pd

        df = pd.DataFrame(response.data)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)
        df_feat = create_features(df)

        features = get_feature_columns()
        df_clean = df_feat.dropna(subset=features)
        X = df_clean[features]

        shap_values = xgboost_model.get_shap_values(X)
        return {"features": shap_values}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/update-data")
async def update_data(req: UpdateDataRequest) -> dict[str, Any]:
    """EPİAŞ'tan yeni veri çeker ve Supabase'e kaydeder."""
    try:
        rows_inserted = collect_data(req.from_date, req.to_date)
        return {"rows_inserted": rows_inserted, "status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/scenario")
async def scenario_analysis(req: ScenarioRequest) -> dict[str, Any]:
    """Senaryo analizi — parametre değiştir, tahmin al."""
    if "xgboost" not in loaded_models:
        raise HTTPException(503, "XGBoost modeli yüklenmemiş.")

    prediction = xgboost_model.predict_scenario(
        hour=req.hour,
        day_of_week=req.day_of_week,
        weather_temp=req.temp,
        is_holiday=req.is_holiday,
    )
    return {"prediction": round(prediction, 2)}
