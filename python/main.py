"""
P2-207: FastAPI Endpoints (Lazy-Load Pattern)
POST /forecast, GET /latest-forecast, GET /model-comparison,
GET /feature-importance, POST /update-data, GET /health

Lazy-Load Stratejisi (Render Free Tier — 512 MB RAM):
  - Modeller istek geldiğinde yüklenir (joblib.load)
  - İşlem bitince bellekten atılır (del + gc.collect)
  - 2 model aynı anda bellekte durmaz
"""

import gc
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import joblib
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL
from data_collector import collect_data
from feature_engineering import create_features, get_feature_columns

# ---------------------------------------------------------------------------
# Model dosya yolları
# ---------------------------------------------------------------------------
MODELS_DIR = Path(__file__).parent / "models" / "saved"

MODEL_PATHS = {
    "prophet": MODELS_DIR / "prophet_model.pkl",
    "xgboost": MODELS_DIR / "xgboost_model.pkl",
}


def get_available_models() -> list[str]:
    """Eğitilmiş ve .pkl dosyası mevcut olan modelleri döndürür."""
    return [name for name, path in MODEL_PATHS.items() if path.exists()]


@contextmanager
def load_model(model_name: str):
    """
    Lazy-load context manager — modeli yükle, kullan, bellekten at.

    Kullanım:
        with load_model("xgboost") as model:
            prediction = model.predict(X)
        # with bloğu bitince model bellekten silinir
    """
    path = MODEL_PATHS.get(model_name)
    if not path or not path.exists():
        raise FileNotFoundError(f"{model_name} modeli bulunamadı: {path}")

    model = joblib.load(path)
    try:
        yield model
    finally:
        del model
        gc.collect()


# ---------------------------------------------------------------------------
# Supabase client (lazy — deploy'da env var gecikmeli yüklenebilir)
# ---------------------------------------------------------------------------
_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None:
        print(f"[SUPABASE] URL length={len(SUPABASE_URL)}, KEY length={len(SUPABASE_SERVICE_KEY)}")
        print(f"[SUPABASE] URL='{SUPABASE_URL[:30]}...'")
        print(f"[SUPABASE] KEY starts='{SUPABASE_SERVICE_KEY[:15]}...' ends='...{SUPABASE_SERVICE_KEY[-5:]}'")
        if not SUPABASE_URL:
            raise ValueError("NEXT_PUBLIC_SUPABASE_URL env var boş!")
        if not SUPABASE_SERVICE_KEY:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY env var boş!")
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase

# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Enerji Tüketim Tahmin API",
    description="Prophet ve XGBoost modelleri ile saatlik enerji tüketim tahmini (Lazy-Load)",
    version="1.1.0",
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
    model: str = "xgboost"  # prophet / xgboost
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
        "models_available": get_available_models(),
        "lazy_load": True,
        "supabase_url_set": bool(SUPABASE_URL),
        "supabase_key_set": bool(SUPABASE_SERVICE_KEY),
    }


@app.post("/forecast")
async def forecast(req: ForecastRequest) -> dict[str, Any]:
    """Zaman serisi tahmini üretir (model lazy-load ile yüklenir)."""
    if req.model not in ("prophet", "xgboost"):
        raise HTTPException(400, f"Geçersiz model: {req.model}")

    if req.model not in get_available_models():
        raise HTTPException(503, f"{req.model} modeli henüz eğitilmemiş. Önce evaluate.py çalıştırın.")

    try:
        import pandas as pd
        import numpy as np

        with load_model(req.model) as model:
            if req.model == "prophet":
                # ProphetForecaster instance — predict(horizon) doğrudan çalışır
                predictions = model.predict(horizon=req.horizon)

            else:
                # XGBoost — son verilerden özellik üret, her adımda güncelle
                response = (
                    get_supabase().table("energy_readings")
                    .select("*")
                    .order("timestamp", desc=True)
                    .limit(200)
                    .execute()
                )
                df = pd.DataFrame(response.data)
                df["timestamp"] = pd.to_datetime(df["timestamp"])
                df = df.sort_values("timestamp").reset_index(drop=True)
                df_feat = create_features(df)
                features = get_feature_columns()

                # Consumption serisini al — rolling hesaplamalar için
                consumption_series = df_feat["consumption_mwh"].tolist()
                last_row = df_feat.iloc[-1][features].copy()

                predictions = []
                for h in range(req.horizon):
                    pred = float(model.predict(pd.DataFrame([last_row]))[0])
                    predictions.append({
                        "timestamp": "",
                        "value": round(pred, 2),
                        "lower": round(pred * 0.95, 2),
                        "upper": round(pred * 1.05, 2),
                    })

                    # Bir sonraki adım için özellikleri güncelle
                    consumption_series.append(pred)
                    last_row["lag_1h"] = pred
                    if len(consumption_series) >= 24:
                        last_row["lag_24h"] = consumption_series[-24]
                    if len(consumption_series) >= 168:
                        last_row["lag_168h"] = consumption_series[-168]

                    recent_24 = consumption_series[-24:]
                    last_row["rolling_mean_24h"] = np.mean(recent_24)
                    last_row["rolling_std_24h"] = np.std(recent_24) if len(recent_24) > 1 else 0

                    if len(consumption_series) >= 168:
                        recent_168 = consumption_series[-168:]
                        last_row["rolling_mean_168h"] = np.mean(recent_168)
                        last_row["rolling_std_168h"] = np.std(recent_168)

                    # Zaman özelliklerini ilerlet
                    current_hour = int(last_row["hour"])
                    next_hour = (current_hour + 1) % 24
                    last_row["hour"] = next_hour

                    if next_hour == 0:
                        next_dow = (int(last_row["day_of_week"]) + 1) % 7
                        last_row["day_of_week"] = next_dow
                        last_row["is_weekend"] = 1 if next_dow >= 5 else 0

        # Son MAPE değerini al
        last_forecast = (
            get_supabase().table("forecasts")
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
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/latest-forecast")
async def latest_forecast(
    model: str = Query(default="xgboost"),
    region: str = Query(default="TR"),
) -> dict[str, Any]:
    """En son tahmin sonuçlarını getirir."""
    response = (
        get_supabase().table("forecasts")
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
async def model_comparison(
    period: str = Query(default="7d"),
) -> dict[str, Any]:
    """Periyot bazlı model karşılaştırması (1d, 7d, 30d, 90d, 180d, 1y)."""
    import json as _json

    # Belirli periyot için en son karşılaştırmayı getir
    response = (
        get_supabase().table("model_comparisons")
        .select("*")
        .eq("dataset_period", period)
        .order("run_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        # Fallback: periyot filtresi olmadan en son kaydı dene
        response = (
            get_supabase().table("model_comparisons")
            .select("*")
            .order("run_at", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data:
            raise HTTPException(404, "Henüz model karşılaştırması yapılmamış.")

    row = response.data[0]

    notes_metrics: dict[str, Any] = {}
    if row.get("notes"):
        try:
            notes_metrics = _json.loads(row["notes"])
        except (ValueError, TypeError):
            pass

    result: dict[str, Any] = {}
    for model_name in ["prophet", "xgboost"]:
        if model_name in notes_metrics:
            result[model_name] = notes_metrics[model_name]
        else:
            result[model_name] = {
                "mape": row.get(f"{model_name}_mape"),
                "rmse": None,
                "mae": None,
                "r2": None,
            }

    result["winner"] = row["winner"]
    result["period"] = row.get("dataset_period", period)
    return result


@app.get("/model-comparison/all")
async def model_comparison_all() -> dict[str, Any]:
    """Tüm periyotlar için model karşılaştırması."""
    import json as _json

    periods = ["1d", "7d", "30d", "90d", "180d", "1y"]
    all_results: dict[str, Any] = {}

    for p in periods:
        response = (
            get_supabase().table("model_comparisons")
            .select("*")
            .eq("dataset_period", p)
            .order("run_at", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data:
            continue

        row = response.data[0]
        notes_metrics: dict[str, Any] = {}
        if row.get("notes"):
            try:
                notes_metrics = _json.loads(row["notes"])
            except (ValueError, TypeError):
                pass

        period_result: dict[str, Any] = {}
        for model_name in ["prophet", "xgboost"]:
            if model_name in notes_metrics:
                period_result[model_name] = notes_metrics[model_name]
            else:
                period_result[model_name] = {
                    "mape": row.get(f"{model_name}_mape"),
                    "rmse": None, "mae": None, "r2": None,
                }
        period_result["winner"] = row["winner"]
        all_results[p] = period_result

    return all_results


@app.get("/feature-importance")
async def feature_importance() -> dict[str, Any]:
    """XGBoost SHAP değerleri (lazy-load)."""
    if "xgboost" not in get_available_models():
        raise HTTPException(503, "XGBoost modeli yüklenmemiş.")

    try:
        import pandas as pd

        response = (
            get_supabase().table("energy_readings")
            .select("*")
            .order("timestamp", desc=True)
            .limit(500)
            .execute()
        )
        df = pd.DataFrame(response.data)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)
        df_feat = create_features(df)

        features = get_feature_columns()
        df_clean = df_feat.dropna(subset=features)
        X = df_clean[features]

        with load_model("xgboost") as model:
            shap_values = model.get_shap_values(X)

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
    """Senaryo analizi — parametre değiştir, tahmin al (lazy-load)."""
    if "xgboost" not in get_available_models():
        raise HTTPException(503, "XGBoost modeli yüklenmemiş.")

    with load_model("xgboost") as model:
        prediction = model.predict_scenario(
            hour=req.hour,
            day_of_week=req.day_of_week,
            weather_temp=req.temp,
            is_holiday=req.is_holiday,
        )
    return {"prediction": round(prediction, 2)}
