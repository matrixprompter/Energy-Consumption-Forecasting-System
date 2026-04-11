"""
P2-206: Model Değerlendirme (Periyot Bazlı)
2 model (Prophet, XGBoost) için 6 farklı periyotta MAPE, RMSE, MAE, R2 hesapla.
Her periyot için ayrı model_comparisons satırı kaydet.
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

_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase
from models import ProphetForecaster, XGBoostForecaster

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Periyot tanımları: key -> (label, saat)
EVAL_PERIODS = {
    "1d": ("1 Gün", 24),
    "7d": ("7 Gün", 168),
    "30d": ("30 Gün", 720),
    "90d": ("90 Gün", 2160),
    "180d": ("180 Gün", 4320),
    "1y": ("1 Yıl", 8760),
}


def load_data_from_supabase() -> pd.DataFrame:
    """energy_readings tablosundan tüm veriyi çeker (paginated)."""
    all_data = []
    batch_size = 1000
    offset = 0

    while True:
        response = (
            get_supabase().table("energy_readings")
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
    2 modeli egitir, tum periyotlar icin ayri ayri degerlendirir.

    Returns:
        {
            "prophet":  {"all_true": [...], "all_pred": [...]},
            "xgboost":  {"all_true": [...], "all_pred": [...], "shap": [...]},
            "periods": {
                "1d":  {"prophet": {metrics}, "xgboost": {metrics}, "winner": "..."},
                "7d":  {...},
                ...
            }
        }
    """
    EVAL_HORIZON = 24

    # Ozellik muhendisligi
    df_feat = create_features(df)
    X_train, X_test, y_train, y_test = prepare_train_test(df_feat)

    # Train/test split
    train_split = int(len(df) * 0.8)
    train_df = df.iloc[:train_split].reset_index(drop=True)
    test_df = df.iloc[train_split:].reset_index(drop=True)

    test_hours = len(test_df)
    max_windows = test_hours // EVAL_HORIZON
    print(f"Test seti: {test_hours} saat, max {max_windows} pencere ({EVAL_HORIZON}h)")

    # -- Prophet Egitim --
    print("\n=== Prophet ===")
    prophet = ProphetForecaster()
    train_metrics = prophet.train(train_df)
    print(f"  Egitim: {train_metrics}")

    # -- XGBoost Egitim --
    print("\n=== XGBoost ===")
    xgb = XGBoostForecaster()
    train_metrics = xgb.train(X_train, y_train)
    print(f"  Egitim: {train_metrics}")

    shap_values = xgb.get_shap_values(X_test)

    # -- Tum pencereleri hesapla (en buyuk periyot kadar) --
    print(f"\n=== Rolling {EVAL_HORIZON}h Tahminler ({max_windows} pencere) ===")

    prophet_all_true, prophet_all_pred = [], []
    xgb_all_true, xgb_all_pred = [], []

    for w in range(max_windows):
        start = w * EVAL_HORIZON
        end = start + EVAL_HORIZON
        y_true_window = test_df["consumption_mwh"].values[start:end]

        # Prophet
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
        feat_start_idx = train_split + start
        if feat_start_idx < len(df_feat):
            xgb_preds_w = xgboost_recursive_forecast(
                xgb.model, df_feat, feat_start_idx, EVAL_HORIZON
            )
        else:
            xgb_preds_w = [np.nan] * EVAL_HORIZON

        xgb_all_true.extend(y_true_window)
        xgb_all_pred.extend(xgb_preds_w)

        if w < 10 or w % 10 == 0:
            print(f"  Pencere {w + 1}/{max_windows}: gercek={np.mean(y_true_window):.0f}, "
                  f"Prophet={np.mean(prophet_preds_w):.0f}, XGBoost={np.mean(xgb_preds_w):.0f}")

    # -- Periyot bazli metrikler --
    print("\n=== Periyot Bazli Sonuclar ===")
    periods_results = {}

    for period_key, (period_label, period_hours) in EVAL_PERIODS.items():
        n_windows_for_period = min(period_hours // EVAL_HORIZON, max_windows)
        if n_windows_for_period == 0:
            continue

        n_points = n_windows_for_period * EVAL_HORIZON

        p_true = np.array(prophet_all_true[:n_points])
        p_pred = np.array(prophet_all_pred[:n_points])
        x_true = np.array(xgb_all_true[:n_points])
        x_pred = np.array(xgb_all_pred[:n_points])

        p_metrics = calc_metrics(p_true, p_pred)
        x_metrics = calc_metrics(x_true, x_pred)

        winner = "prophet" if p_metrics["mape"] <= x_metrics["mape"] else "xgboost"

        periods_results[period_key] = {
            "prophet": p_metrics,
            "xgboost": x_metrics,
            "winner": winner,
            "windows": n_windows_for_period,
        }

        print(f"  {period_label:>8} ({n_windows_for_period} pencere): "
              f"Prophet MAPE={p_metrics['mape']:.2f}%, XGBoost MAPE={x_metrics['mape']:.2f}% "
              f"-> Kazanan: {winner.upper()}")

    return {
        "prophet": {
            "all_true": prophet_all_true,
            "all_pred": prophet_all_pred,
        },
        "xgboost": {
            "all_true": xgb_all_true,
            "all_pred": xgb_all_pred,
            "shap": shap_values,
        },
        "periods": periods_results,
        "test_df": test_df,
        "train_split": train_split,
    }


def plot_actual_vs_predicted(
    test_df: pd.DataFrame,
    results: dict,
    max_points: int = 168,
) -> str:
    """Gercek vs Tahmin grafigi PNG olarak kaydeder."""
    timestamps = test_df["timestamp"].values[:max_points]
    actual = test_df["consumption_mwh"].values[:max_points]

    fig, ax = plt.subplots(figsize=(16, 6))

    ax.plot(timestamps, actual, label="Gercek", color="#1f77b4", linewidth=2)

    colors = {"prophet": "#ff7f0e", "xgboost": "#2ca02c"}
    for model_name, color in colors.items():
        preds = results[model_name]["all_pred"][:max_points]
        ax.plot(timestamps[:len(preds)], preds, label=f"{model_name.upper()}", color=color, linewidth=1.2, linestyle="--")

    ax.set_title("Enerji Tuketim Tahmini - Gercek vs Prophet & XGBoost", fontsize=14)
    ax.set_xlabel("Zaman")
    ax.set_ylabel("Tuketim (MWh)")
    ax.legend(loc="upper right")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()

    path = OUTPUT_DIR / "actual_vs_predicted.png"
    fig.savefig(path, dpi=150)
    plt.close(fig)
    print(f"Grafik kaydedildi: {path}")
    return str(path)


def plot_model_metrics(results: dict) -> str:
    """Model karsilastirma bar chart PNG (7d periyodu icin)."""
    period_data = results["periods"].get("7d")
    if not period_data:
        # Fallback: ilk mevcut periyot
        period_data = next(iter(results["periods"].values()))

    models = ["prophet", "xgboost"]
    metrics = ["mape", "rmse", "mae", "r2"]
    labels = ["MAPE (%)", "RMSE", "MAE", "R2"]

    fig, axes = plt.subplots(1, 4, figsize=(18, 5))
    colors = ["#ff7f0e", "#2ca02c"]

    for i, (metric, label) in enumerate(zip(metrics, labels)):
        values = [period_data[m][metric] for m in models]
        bars = axes[i].bar([m.upper() for m in models], values, color=colors)

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

    fig.suptitle("Model Karsilastirma Metrikleri (7 Gun)", fontsize=14, y=1.02)
    fig.tight_layout()

    path = OUTPUT_DIR / "model_comparison.png"
    fig.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"Grafik kaydedildi: {path}")
    return str(path)


def save_comparisons_to_supabase(results: dict) -> None:
    """Her periyot icin ayri model_comparisons satiri kaydet."""
    import json

    for period_key, period_data in results["periods"].items():
        full_metrics = {
            "prophet": period_data["prophet"],
            "xgboost": period_data["xgboost"],
        }

        get_supabase().table("model_comparisons").insert(
            {
                "prophet_mape": period_data["prophet"]["mape"],
                "xgboost_mape": period_data["xgboost"]["mape"],
                "sarima_mape": 0,
                "winner": period_data["winner"],
                "dataset_period": period_key,
                "notes": json.dumps(full_metrics),
            }
        ).execute()

    print(f"model_comparisons: {len(results['periods'])} periyot kaydedildi.")


def save_forecasts_to_supabase(results: dict) -> None:
    """Her model icin forecasts tablosuna kaydet."""
    for model_name in ["prophet", "xgboost"]:
        preds = results[model_name]["all_pred"]

        # 7d periyot metriklerini kullan (varsayilan)
        period_data = results["periods"].get("7d") or next(iter(results["periods"].values()))
        metrics = period_data[model_name]

        get_supabase().table("forecasts").insert(
            {
                "model_name": model_name,
                "forecast_horizon": len(preds),
                "predictions": [
                    {"timestamp": "", "value": round(float(p), 2), "lower": 0, "upper": 0}
                    if isinstance(p, (int, float))
                    else p
                    for p in preds[:168]  # Son 7 gun
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
    print("Veri yukleniyor...")
    df = load_data_from_supabase()
    print(f"Toplam satir: {len(df)}")

    if len(df) < 200:
        print("UYARI: Yeterli veri yok (minimum 200 satir). Once data_collector.py calistirin.")
    else:
        results = evaluate_all_models(df)

        print("\nGrafikler olusturuluyor...")
        plot_actual_vs_predicted(results["test_df"], results)
        plot_model_metrics(results)

        print("\nSupabase'e kaydediliyor...")
        save_comparisons_to_supabase(results)
        save_forecasts_to_supabase(results)

        print("\n=== Degerlendirme tamamlandi! ===")
        for pk, pd_data in results["periods"].items():
            label = EVAL_PERIODS[pk][0]
            print(f"\n  {label}:")
            for m in ["prophet", "xgboost"]:
                met = pd_data[m]
                print(f"    {m.upper():>8}: MAPE={met['mape']:.2f}%, RMSE={met['rmse']:.2f}, MAE={met['mae']:.2f}, R2={met['r2']:.4f}")
            print(f"    Kazanan: {pd_data['winner'].upper()}")
