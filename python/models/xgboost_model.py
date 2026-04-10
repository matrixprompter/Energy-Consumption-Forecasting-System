"""
P2-204: XGBoost Modeli
XGBRegressor + SHAP açıklanabilirlik
"""

import joblib
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import shap
from xgboost import XGBRegressor

from feature_engineering import get_feature_columns, FEATURE_LABELS_TR


class XGBoostForecaster:
    """XGBoost tabanlı enerji tüketim tahmin modeli."""

    def __init__(self):
        self.model: XGBRegressor | None = None
        self.shap_values: np.ndarray | None = None
        self.feature_names: list[str] = get_feature_columns()
        self.model_path = Path(__file__).parent / "saved" / "xgboost_model.pkl"

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_val: pd.DataFrame | None = None,
        y_val: pd.Series | None = None,
    ) -> dict[str, float]:
        """
        XGBoost modeli eğitir.

        Returns:
            Eğitim metrikleri
        """
        self.model = XGBRegressor(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            random_state=42,
            n_jobs=-1,
        )

        fit_params: dict[str, Any] = {}
        if X_val is not None and y_val is not None:
            fit_params["eval_set"] = [(X_val, y_val)]
            fit_params["verbose"] = 50

        self.model.fit(X_train, y_train, **fit_params)

        # Eğitim metrikleri
        y_pred = self.model.predict(X_train)
        mape = np.mean(np.abs((y_train.values - y_pred) / y_train.values)) * 100
        rmse = np.sqrt(np.mean((y_train.values - y_pred) ** 2))
        mae = np.mean(np.abs(y_train.values - y_pred))

        self._save_model()

        return {"mape": round(mape, 2), "rmse": round(rmse, 2), "mae": round(mae, 2)}

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Tahmin üretir."""
        if self.model is None:
            self._load_model()
        return self.model.predict(X)

    def evaluate(
        self, X_test: pd.DataFrame, y_test: pd.Series
    ) -> tuple[dict[str, float], list[float]]:
        """
        Test seti üzerinde değerlendir.

        Returns:
            (metrikler dict, tahmin listesi)
        """
        if self.model is None:
            self._load_model()

        y_pred = self.model.predict(X_test)
        y_true = y_test.values

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

    def get_shap_values(
        self, X: pd.DataFrame, max_samples: int = 500
    ) -> list[dict[str, Any]]:
        """
        SHAP değerlerini hesaplar — özellik önem sıralaması.

        Returns:
            [{"name": "Sıcaklık (°C)", "feature": "weather_temp", "shap_value": 1234.5}, ...]
        """
        if self.model is None:
            self._load_model()

        sample = X.head(max_samples)
        explainer = shap.TreeExplainer(self.model)
        shap_vals = explainer.shap_values(sample)

        mean_abs_shap = np.abs(shap_vals).mean(axis=0)

        results = []
        for i, feat in enumerate(self.feature_names):
            results.append(
                {
                    "name": FEATURE_LABELS_TR.get(feat, feat),
                    "feature": feat,
                    "shap_value": round(float(mean_abs_shap[i]), 2),
                }
            )

        results.sort(key=lambda x: x["shap_value"], reverse=True)
        return results

    def predict_scenario(
        self, hour: int, day_of_week: int, weather_temp: float, is_holiday: bool,
        base_features: dict[str, float] | None = None,
    ) -> float:
        """
        Senaryo analizi — tek bir nokta tahmini.

        Args:
            hour: Saat (0-23)
            day_of_week: Haftanın günü (0-6)
            weather_temp: Sıcaklık
            is_holiday: Tatil mi?
            base_features: Diğer özellikler için varsayılan değerler

        Returns:
            Tahmini tüketim (MWh)
        """
        if self.model is None:
            self._load_model()

        defaults = {
            "lag_1h": 30000.0,
            "lag_24h": 30000.0,
            "lag_168h": 30000.0,
            "rolling_mean_24h": 30000.0,
            "rolling_std_24h": 2000.0,
            "rolling_mean_168h": 30000.0,
            "rolling_std_168h": 2500.0,
            "month": 6,
            "season": 2,
        }

        if base_features:
            defaults.update(base_features)

        row = {
            **defaults,
            "hour": hour,
            "day_of_week": day_of_week,
            "is_holiday_int": int(is_holiday),
            "is_weekend": int(day_of_week >= 5),
            "weather_temp": weather_temp,
        }

        X = pd.DataFrame([row])[self.feature_names]
        return float(self.model.predict(X)[0])

    def _save_model(self):
        """Modeli .pkl olarak kaydeder (joblib — lazy-load uyumlu)."""
        self.model_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, self.model_path, compress=3)

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f"XGBoost model bulunamadı: {self.model_path}")
        loaded = joblib.load(self.model_path)
        self.model = loaded.model
