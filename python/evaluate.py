"""
P2-206: Model Değerlendirme
3 model için MAPE, RMSE, MAE, R2 hesapla.
model_comparisons tablosuna kaydet.
Gerçek vs Tahmin grafiği PNG.
"""

from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # GUI olmayan ortamlar için
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL
from supabase import create_client
from feature_engineering import create_features, prepare_train_test

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
from models import ProphetForecaster, SARIMAForecaster, XGBoostForecaster

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_data_from_supabase() -> pd.DataFrame:
    """energy_readings tablosundan tüm veriyi çeker (paginated)."""
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
        response = (
            supabase.table("energy_readings")
            .select("*")
            .order("timestamp", desc=False)
            .range(offset, offset + batch_size - 1)
            .execute()
        )
        if not response.data:
            break
        all_data.extend(response.data)
        if len(response.data) < batch_size:
            break
        offset += batch_size

    df = pd.DataFrame(all_data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def calc_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """MAPE, RMSE, MAE, R2 hesaplar."""
    mask = ~(np.isnan(y_true) | np.isnan(y_pred)) & (y_true != 0)
    y_t = y_true[mask]
    y_p = y_pred[mask]
    if len(y_t) == 0:
        return {"mape": 0.0, "rmse": 0.0, "mae": 0.0, "r2": 0.0}

    mape = np.mean(np.abs((y_t - y_p) / y_t)) * 100
    rmse = np.sqrt(np.mean((y_t - y_p) ** 2))
    mae = np.mean(np.abs(y_t - y_p))
    ss_res = np.sum((y_t - y_p) ** 2)
    ss_tot = np.sum((y_t - np.mean(y_t)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

    return {
        "mape": round(mape, 2),
        "rmse": round(rmse, 2),
        "mae": round(mae, 2),
        "r2": round(r2, 4),
    }


def xgboost_recursive_forecast(
    model, df_feat: pd.DataFrame, start_idx: int, horizon: int
) -> list[float]:
    """
    XGBoost için recursive multi-step tahmin.
    Her adımda tahmin edilen değer bir sonraki adımın lag özelliği olur.
    (Üretim /forecast endpoint'indeki mantığın aynısı.)
    """
    from feature_engineering import get_feature_columns

    features = get_feature_columns()
    consumption_series = df_feat["consumption_mwh"].iloc[:start_idx].tolist()
    last_row = df_feat.iloc[start_idx - 1][features].copy()

    predictions = []
    for _ in range(horizon):
        pred = float(model.predict(pd.DataFrame([last_row]))[0])
        predictions.append(pred)

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

        current_hour = int(last_row["hour"])
        next_hour = (current_hour + 1) % 24
        last_row["hour"] = next_hour
        if next_hour == 0:
            next_dow = (int(last_row["day_of_week"]) + 1) % 7
            last_row["day_of_week"] = next_dow
            last_row["is_weekend"] = 1 if next_dow >= 5 else 0

    return predictions


def evaluate_all_models(df: pd.DataFrame) -> dict:
    """
    3 modeli eğitir ve ADİL şekilde değerlendirir.

    Adil değerlendirme: Tüm modeller aynı test penceresinde
    24 saat ileriye tahmin yapar. Rolling pencereler ile
    birden fazla test noktası kullanılır.

    Returns:
        {
            "prophet":  {"metrics": {...}, "predictions": [...]},
            "xgboost":  {"metrics": {...}, "predictions": [...]},
            "sarima":   {"metrics": {...}, "predictions": [...]},
            "winner": "xgboost"
        }
    """
    results = {}

    EVAL_HORIZON = 24  # Her pencerede 24 saat ileriye tahmin

    # Özellik mühendisliği (XGBoost için)
    df_feat = create_features(df)
    X_train, X_test, y_train, y_test = prepare_train_test(df_feat)

    # Train/test split index
    train_split = int(len(df) * 0.8)
    train_df = df.iloc[:train_split].reset_index(drop=True)
    test_df = df.iloc[train_split:].reset_index(drop=True)

    test_hours = len(test_df)
    n_windows = min(test_hours // EVAL_HORIZON, 7)  # Maks 7 pencere (1 hafta)
    print(f"Test seti: {test_hours} saat, {n_windows} pencere ({EVAL_HORIZON}h)")

    # ── Prophet Eğitim ──
    print("\n=== Prophet ===")
    prophet = ProphetForecaster()
    train_metrics = prophet.train(train_df)
    print(f"  Eğitim: {train_metrics}")

    # ── XGBoost Eğitim ──
    print("\n=== XGBoost ===")
    xgb = XGBoostForecaster()
    train_metrics = xgb.train(X_train, y_train)
    print(f"  Eğitim: {train_metrics}")

    # SHAP değerleri
    shap_values = xgb.get_shap_values(X_test)

    # ── SARIMA Eğitim ──
    print("\n=== SARIMA ===")
    sarima = SARIMAForecaster()
    train_metrics = sarima.train(train_df)
    print(f"  Eğitim: {train_metrics}")

    # ── Rolling 24-step Forecast Değerlendirme ──
    print(f"\n=== Adil Değerlendirme ({n_windows} pencere × {EVAL_HORIZON}h) ===")

    prophet_all_true, prophet_all_pred = [], []
    xgb_all_true, xgb_all_pred = [], []
    sarima_all_true, sarima_all_pred = [], []

    # SARIMA: Tüm test periyodunu tek seferde tahmin et, sonra pencere pencere kes
    sarima_total_steps = n_windows * EVAL_HORIZON
    try:
        sarima_forecast = sarima.model.get_forecast(steps=sarima_total_steps)
        sarima_mean = sarima_forecast.predicted_mean.values
    except Exception as e:
        print(f"  SARIMA forecast hatası: {e}")
        sarima_mean = np.full(sarima_total_steps, np.nan)

    for w in range(n_windows):
        start = w * EVAL_HORIZON
        end = start + EVAL_HORIZON
        y_true_window = test_df["consumption_mwh"].values[start:end]

        # Prophet: test timestamp'leri ile tahmin
        window_df = test_df.iloc[start:end][["timestamp", "consumption_mwh"]].rename(
            columns={"timestamp": "ds", "consumption_mwh": "y"}
        )
        window_df["ds"] = window_df["ds"].dt.tz_localize(None)
        if "weather_temp" in prophet.model.extra_regressors and "weather_temp" in test_df.columns:
            window_df["weather_temp"] = test_df.iloc[start:end]["weather_temp"].fillna(
                test_df["weather_temp"].median()
            ).values
        prophet_fc = prophet.model.predict(window_df)
        prophet_preds_w = prophet_fc["yhat"].values

        prophet_all_true.extend(y_true_window)
        prophet_all_pred.extend(prophet_preds_w)

        # XGBoost: recursive multi-step
        feat_start_idx = train_split + start  # df_feat'teki mutlak indeks
        if feat_start_idx < len(df_feat):
            xgb_preds_w = xgboost_recursive_forecast(
                xgb.model, df_feat, feat_start_idx, EVAL_HORIZON
            )
        else:
            xgb_preds_w = [np.nan] * EVAL_HORIZON

        xgb_all_true.extend(y_true_window)
        xgb_all_pred.extend(xgb_preds_w)

        # SARIMA: önceden hesaplanan tahminden pencereyi kes
        sarima_preds_w = sarima_mean[start:end]

        sarima_all_true.extend(y_true_window)
        sarima_all_pred.extend(sarima_preds_w)

        print(f"  Pencere {w + 1}: gerçek ort={np.mean(y_true_window):.0f}, "
              f"Prophet={np.mean(prophet_preds_w):.0f}, "
              f"XGBoost={np.mean(xgb_preds_w):.0f}, "
              f"SARIMA={np.mean(sarima_preds_w):.0f}")

    # Metrikleri hesapla
    prophet_metrics = calc_metrics(np.array(prophet_all_true), np.array(prophet_all_pred))
    xgb_metrics = calc_metrics(np.array(xgb_all_true), np.array(xgb_all_pred))
    sarima_metrics = calc_metrics(np.array(sarima_all_true), np.array(sarima_all_pred))

    print(f"\n  Prophet:  {prophet_metrics}")
    print(f"  XGBoost:  {xgb_metrics}")
    print(f"  SARIMA:   {sarima_metrics}")

    results["prophet"] = {"metrics": prophet_metrics, "predictions": prophet_all_pred}
    results["xgboost"] = {"metrics": xgb_metrics, "predictions": xgb_all_pred}
    results["xgboost"]["shap"] = shap_values
    results["sarima"] = {"metrics": sarima_metrics, "predictions": sarima_all_pred}

    # ── Kazanan ──
    mapes = {
        "prophet": prophet_metrics["mape"],
        "xgboost": xgb_metrics["mape"],
        "sarima": sarima_metrics["mape"],
    }
    winner = min(mapes, key=mapes.get)
    results["winner"] = winner
    print(f"\nKazanan: {winner} (MAPE: {mapes[winner]}%)")

    return results


def plot_actual_vs_predicted(
    test_df: pd.DataFrame,
    results: dict,
    max_points: int = 168,
) -> str:
    """Gerçek vs Tahmin grafiği PNG olarak kaydeder."""
    timestamps = test_df["timestamp"].values[:max_points]
    actual = test_df["consumption_mwh"].values[:max_points]

    fig, ax = plt.subplots(figsize=(16, 6))

    ax.plot(timestamps, actual, label="Gerçek", color="#1f77b4", linewidth=2)

    colors = {"prophet": "#ff7f0e", "xgboost": "#2ca02c", "sarima": "#d62728"}
    for model_name, color in colors.items():
        preds = results[model_name]["predictions"][:max_points]
        ax.plot(timestamps[:len(preds)], preds, label=f"{model_name.upper()}", color=color, linewidth=1.2, linestyle="--")

    ax.set_title("Enerji Tüketim Tahmini — Gerçek vs Model Tahminleri", fontsize=14)
    ax.set_xlabel("Zaman")
    ax.set_ylabel("Tüketim (MWh)")
    ax.legend(loc="upper right")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    path = OUTPUT_DIR / "actual_vs_predicted.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Grafik kaydedildi: {path}")
    return str(path)


def plot_model_metrics(results: dict) -> str:
    """Model karşılaştırma bar chart PNG."""
    models = ["prophet", "xgboost", "sarima"]
    metrics = ["mape", "rmse", "mae", "r2"]
    labels = ["MAPE (%)", "RMSE", "MAE", "R2"]

    fig, axes = plt.subplots(1, 4, figsize=(18, 5))
    colors = ["#ff7f0e", "#2ca02c", "#d62728"]

    for i, (metric, label) in enumerate(zip(metrics, labels)):
        values = [results[m]["metrics"][metric] for m in models]
        bars = axes[i].bar([m.upper() for m in models], values, color=colors)

        # En iyi değeri yeşil yap
        if metric == "r2":
            best_idx = values.index(max(values))
        else:
            best_idx = values.index(min(values))
        bars[best_idx].set_color("#28a745")

        axes[i].set_title(label, fontsize=12)
        axes[i].grid(True, alpha=0.3, axis="y")

        for bar, val in zip(bars, values):
            axes[i].text(
                bar.get_x() + bar.get_width() / 2, bar.get_height(),
                f"{val:.2f}", ha="center", va="bottom", fontsize=10,
            )

    fig.suptitle("Model Karşılaştırma Metrikleri", fontsize=14, y=1.02)
    fig.tight_layout()

    path = OUTPUT_DIR / "model_comparison.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Grafik kaydedildi: {path}")
    return str(path)


def save_comparison_to_supabase(results: dict) -> None:
    """model_comparisons tablosuna kaydet."""
    supabase.table("model_comparisons").insert(
        {
            "prophet_mape": results["prophet"]["metrics"]["mape"],
            "xgboost_mape": results["xgboost"]["metrics"]["mape"],
            "sarima_mape": results["sarima"]["metrics"]["mape"],
            "winner": results["winner"],
            "notes": "Otomatik değerlendirme — evaluate.py",
        }
    ).execute()
    print("model_comparisons tablosuna kaydedildi.")


def save_forecasts_to_supabase(results: dict) -> None:
    """Her model için forecasts tablosuna kaydet."""
    for model_name in ["prophet", "xgboost", "sarima"]:
        metrics = results[model_name]["metrics"]
        preds = results[model_name]["predictions"]

        supabase.table("forecasts").insert(
            {
                "model_name": model_name,
                "forecast_horizon": len(preds),
                "predictions": [
                    {"timestamp": "", "value": p, "lower": 0, "upper": 0}
                    if isinstance(p, (int, float))
                    else p
                    for p in preds
                ],
                "mape": metrics["mape"],
                "rmse": metrics["rmse"],
                "mae": metrics["mae"],
            }
        ).execute()

    print("forecasts tablosuna kaydedildi.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Veri yükleniyor...")
    df = load_data_from_supabase()
    print(f"Toplam satır: {len(df)}")

    if len(df) < 200:
        print("UYARI: Yeterli veri yok (minimum 200 satır). Önce data_collector.py çalıştırın.")
    else:
        results = evaluate_all_models(df)

        print("\nGrafikler oluşturuluyor...")
        test_start = int(len(df) * 0.8)
        test_df = df.iloc[test_start:].reset_index(drop=True)
        plot_actual_vs_predicted(test_df, results)
        plot_model_metrics(results)

        print("\nSupabase'e kaydediliyor...")
        save_comparison_to_supabase(results)
        save_forecasts_to_supabase(results)

        print("\n=== Değerlendirme tamamlandı! ===")
        for m in ["prophet", "xgboost", "sarima"]:
            met = results[m]["metrics"]
            print(f"  {m.upper():>8}: MAPE={met['mape']:.2f}%, RMSE={met['rmse']:.2f}, MAE={met['mae']:.2f}, R2={met['r2']:.4f}")
        print(f"  Kazanan: {results['winner'].upper()}")
