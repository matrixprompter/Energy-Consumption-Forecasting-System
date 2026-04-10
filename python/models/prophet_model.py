"""
P2-203: Prophet Modeli
Meta Prophet — günlük + yıllık mevsimsellik, tatil günleri, güven aralıkları
"""

import pickle
from pathlib import Path
from typing import Any

import holidays
import numpy as np
import pandas as pd
from prophet import Prophet


class ProphetForecaster:
    """Prophet zaman serisi tahmin modeli."""

    def __init__(self):
        self.model: Prophet | None = None
        self.model_path = Path(__file__).parent / "saved" / "prophet_model.pkl"

    def train(self, df: pd.DataFrame) -> dict[str, float]:
        """
        Prophet modeli eğitir.

        Args:
            df: timestamp ve consumption_mwh kolonları olan DataFrame

        Returns:
            Eğitim metrikleri (in-sample)
        """
        # Prophet formatı: ds (tarih), y (hedef)
        prophet_df = df[["timestamp", "consumption_mwh"]].rename(
            columns={"timestamp": "ds", "consumption_mwh": "y"}
        )
        # Timezone bilgisini kaldır (Prophet gereksinimi)
        prophet_df["ds"] = prophet_df["ds"].dt.tz_localize(None)

        # Türkiye tatillerini ekle
        tr_holidays = holidays.Turkey(years=range(2022, 2027))
        holiday_df = pd.DataFrame(
            [{"holiday": name, "ds": pd.to_datetime(date)}
             for date, name in sorted(tr_holidays.items())]
        )

        self.model = Prophet(
            daily_seasonality=True,
            yearly_seasonality=True,
            weekly_seasonality=True,
            holidays=holiday_df,
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10.0,
            interval_width=0.95,
        )

        # Sıcaklık regressor (varsa)
        if "weather_temp" in df.columns:
            prophet_df["weather_temp"] = df["weather_temp"].values
            self.model.add_regressor("weather_temp")

        self.model.fit(prophet_df)

        # In-sample metrikler
        fitted = self.model.predict(prophet_df)
        mape = np.mean(np.abs((prophet_df["y"].values - fitted["yhat"].values) / prophet_df["y"].values)) * 100
        rmse = np.sqrt(np.mean((prophet_df["y"].values - fitted["yhat"].values) ** 2))
        mae = np.mean(np.abs(prophet_df["y"].values - fitted["yhat"].values))

        self._save_model()

        return {"mape": round(mape, 2), "rmse": round(rmse, 2), "mae": round(mae, 2)}

    def predict(
        self,
        horizon: int = 24,
        weather_temp: list[float] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Gelecek tahmini üretir.

        Args:
            horizon: Tahmin ufku (saat)
            weather_temp: Gelecek saatler için sıcaklık tahmini

        Returns:
            [{timestamp, value, lower, upper}, ...]
        """
        if self.model is None:
            self._load_model()

        future = self.model.make_future_dataframe(periods=horizon, freq="h")
        future = future.tail(horizon).reset_index(drop=True)

        if "weather_temp" in self.model.extra_regressors and weather_temp:
            future["weather_temp"] = weather_temp[:horizon]
        elif "weather_temp" in self.model.extra_regressors:
            future["weather_temp"] = 15.0  # Varsayılan

        forecast = self.model.predict(future)

        predictions = []
        for _, row in forecast.iterrows():
            predictions.append(
                {
                    "timestamp": row["ds"].isoformat(),
                    "value": round(float(row["yhat"]), 2),
                    "lower": round(float(row["yhat_lower"]), 2),
                    "upper": round(float(row["yhat_upper"]), 2),
                }
            )

        return predictions

    def evaluate(
        self, test_df: pd.DataFrame
    ) -> tuple[dict[str, float], list[float]]:
        """
        Test seti üzerinde değerlendir.

        Returns:
            (metrikler dict, tahmin listesi)
        """
        if self.model is None:
            self._load_model()

        eval_df = test_df[["timestamp", "consumption_mwh"]].rename(
            columns={"timestamp": "ds", "consumption_mwh": "y"}
        )
        eval_df["ds"] = eval_df["ds"].dt.tz_localize(None)

        if "weather_temp" in self.model.extra_regressors and "weather_temp" in test_df.columns:
            eval_df["weather_temp"] = test_df["weather_temp"].values

        forecast = self.model.predict(eval_df)
        y_true = eval_df["y"].values
        y_pred = forecast["yhat"].values

        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
        mae = np.mean(np.abs(y_true - y_pred))
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        r2 = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

        metrics = {
            "mape": round(mape, 2),
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "r2": round(r2, 4),
        }

        return metrics, y_pred.tolist()

    def _save_model(self):
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.model_path, "wb") as f:
            pickle.dump(self.model, f)

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"Prophet model bulunamadı: {self.model_path}")
        with open(self.model_path, "rb") as f:
            self.model = pickle.load(f)
