"""
P2-205: SARIMA Modeli
SARIMAX + auto_arima parametreleri, son 2000 nokta (hız için)
"""

import pickle
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from pmdarima import auto_arima
from statsmodels.tsa.statespace.sarimax import SARIMAX


class SARIMAForecaster:
    """SARIMA zaman serisi tahmin modeli."""

    MAX_POINTS = 2000  # Hız için son 2000 nokta

    def __init__(self):
        self.model = None
        self.order: tuple = (1, 1, 1)
        self.seasonal_order: tuple = (1, 1, 1, 24)
        self.model_path = Path(__file__).parent / "saved" / "sarima_model.pkl"

    def train(
        self, df: pd.DataFrame, auto_select: bool = True
    ) -> dict[str, float]:
        """
        SARIMA modeli eğitir.

        Args:
            df: timestamp ve consumption_mwh kolonları olan DataFrame
            auto_select: True ise auto_arima ile optimal parametreleri bul

        Returns:
            Eğitim metrikleri
        """
        series = df.set_index("timestamp")["consumption_mwh"].asfreq("h")
        series = series.fillna(method="ffill")

        # Son N noktayı al (hız için)
        series = series.tail(self.MAX_POINTS)

        if auto_select:
            print("auto_arima çalışıyor (bu biraz sürebilir)...")
            auto_model = auto_arima(
                series,
                seasonal=True,
                m=24,  # Saatlik mevsimsellik
                max_p=3,
                max_q=3,
                max_P=2,
                max_Q=2,
                max_d=2,
                max_D=1,
                stepwise=True,
                suppress_warnings=True,
                error_action="ignore",
                trace=False,
            )
            self.order = auto_model.order
            self.seasonal_order = auto_model.seasonal_order
            print(f"Seçilen parametreler: order={self.order}, seasonal={self.seasonal_order}")

        self.model = SARIMAX(
            series,
            order=self.order,
            seasonal_order=self.seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(disp=False)

        # In-sample metrikler
        fitted = self.model.fittedvalues
        y_true = series.values
        y_pred = fitted.values

        # İlk birkaç değer NaN olabilir
        mask = ~np.isnan(y_pred)
        y_true = y_true[mask]
        y_pred = y_pred[mask]

        mape = np.mean(np.abs((y_true - y_pred) / y_true)) * 100
        rmse = np.sqrt(np.mean((y_true - y_pred) ** 2))
        mae = np.mean(np.abs(y_true - y_pred))

        self._save_model()

        return {"mape": round(mape, 2), "rmse": round(rmse, 2), "mae": round(mae, 2)}

    def predict(self, horizon: int = 24) -> list[dict[str, Any]]:
        """
        Gelecek tahmini üretir.

        Args:
            horizon: Tahmin ufku (saat)

        Returns:
            [{timestamp, value, lower, upper}, ...]
        """
        if self.model is None:
            self._load_model()

        forecast = self.model.get_forecast(steps=horizon)
        mean = forecast.predicted_mean
        conf = forecast.conf_int(alpha=0.05)  # %95 güven aralığı

        predictions = []
        for i in range(horizon):
            predictions.append(
                {
                    "timestamp": str(mean.index[i]),
                    "value": round(float(mean.iloc[i]), 2),
                    "lower": round(float(conf.iloc[i, 0]), 2),
                    "upper": round(float(conf.iloc[i, 1]), 2),
                }
            )

        return predictions

    def evaluate(
        self, test_df: pd.DataFrame
    ) -> tuple[dict[str, float], list[float]]:
        """
        Test seti üzerinde değerlendir (one-step-ahead forecasting).

        Returns:
            (metrikler dict, tahmin listesi)
        """
        if self.model is None:
            self._load_model()

        test_series = test_df.set_index("timestamp")["consumption_mwh"]

        forecast = self.model.get_forecast(steps=len(test_series))
        y_pred = forecast.predicted_mean.values
        y_true = test_series.values

        # NaN kontrolü
        mask = ~(np.isnan(y_pred) | np.isnan(y_true))
        y_true = y_true[mask]
        y_pred = y_pred[mask]

        if len(y_true) == 0:
            return {"mape": 0, "rmse": 0, "mae": 0, "r2": 0}, []

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
            pickle.dump(
                {
                    "model": self.model,
                    "order": self.order,
                    "seasonal_order": self.seasonal_order,
                },
                f,
            )

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"SARIMA model bulunamadı: {self.model_path}")
        with open(self.model_path, "rb") as f:
            data = pickle.load(f)
            self.model = data["model"]
            self.order = data["order"]
            self.seasonal_order = data["seasonal_order"]
