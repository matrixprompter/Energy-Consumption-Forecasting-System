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
from supabase import create_client

from config import SUPABASE_SERVICE_KEY, SUPABASE_URL
from data_collector import supabase
from feature_engineering import create_features, prepare_train_test
from models import ProphetForecaster, SARIMAForecaster, XGBoostForecaster

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_data_from_supabase() -> pd.DataFrame:
    """energy_readings tablosundan tüm veriyi çeker."""
    response = (
        supabase.table("energy_readings")
        .select("*")
        .order("timestamp", desc=False)
        .execute()
    )
    df = pd.DataFrame(response.data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def evaluate_all_models(df: pd.DataFrame) -> dict:
    """
    3 modeli eğitir, değerlendirir ve sonuçları döndürür.

    Returns:
        {
            "prophet":  {"metrics": {...}, "predictions": [...]},
            "xgboost":  {"metrics": {...}, "predictions": [...]},
            "sarima":   {"metrics": {...}, "predictions": [...]},
            "winner": "xgboost"
        }
    """
    results = {}

    # Özellik mühendisliği (XGBoost için)
    df_feat = create_features(df)
    X_train, X_test, y_train, y_test = prepare_train_test(df_feat)

    # Test dönemi timestamp'leri
    test_start_idx = len(df) - len(y_test)
    test_df = df.iloc[test_start_idx:].reset_index(drop=True)

    # ── Prophet ──
    print("\n=== Prophet ===")
    prophet = ProphetForecaster()
    train_split = int(len(df) * 0.8)
    train_metrics = prophet.train(df.iloc[:train_split])
    print(f"  Eğitim: {train_metrics}")
    prophet_metrics, prophet_preds = prophet.evaluate(test_df)
    print(f"  Test:   {prophet_metrics}")
    results["prophet"] = {"metrics": prophet_metrics, "predictions": prophet_preds}

    # ── XGBoost ──
    print("\n=== XGBoost ===")
    xgb = XGBoostForecaster()
    train_metrics = xgb.train(X_train, y_train)
    print(f"  Eğitim: {train_metrics}")
    xgb_metrics, xgb_preds = xgb.evaluate(X_test, y_test)
    print(f"  Test:   {xgb_metrics}")
    results["xgboost"] = {"metrics": xgb_metrics, "predictions": xgb_preds}

    # SHAP değerleri
    shap_values = xgb.get_shap_values(X_test)
    results["xgboost"]["shap"] = shap_values

    # ── SARIMA ──
    print("\n=== SARIMA ===")
    sarima = SARIMAForecaster()
    train_metrics = sarima.train(df.iloc[:train_split])
    print(f"  Eğitim: {train_metrics}")
    sarima_metrics, sarima_preds = sarima.evaluate(test_df)
    print(f"  Test:   {sarima_metrics}")
    results["sarima"] = {"metrics": sarima_metrics, "predictions": sarima_preds}

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
