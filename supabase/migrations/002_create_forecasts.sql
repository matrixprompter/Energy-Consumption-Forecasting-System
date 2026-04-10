-- P2-102: forecasts tablosu
-- Model tahmin sonuçlarını saklar (Prophet, XGBoost, SARIMA)

CREATE TABLE IF NOT EXISTS forecasts (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  model_name        text        NOT NULL CHECK (model_name IN ('prophet', 'xgboost', 'sarima')),
  forecast_horizon  int         NOT NULL CHECK (forecast_horizon > 0),
  predictions       jsonb       NOT NULL,
  mape              float8,
  rmse              float8,
  mae               float8,
  input_window      int,
  metadata          jsonb       DEFAULT '{}'::jsonb
);

COMMENT ON TABLE forecasts IS 'ML model tahmin sonuçları ve hata metrikleri';
COMMENT ON COLUMN forecasts.predictions IS 'JSON array: [{timestamp, value, lower, upper}, ...]';
COMMENT ON COLUMN forecasts.forecast_horizon IS 'Tahmin ufku (saat): 24, 48 veya 168';
COMMENT ON COLUMN forecasts.mape IS 'Mean Absolute Percentage Error (%)';
COMMENT ON COLUMN forecasts.rmse IS 'Root Mean Square Error';
COMMENT ON COLUMN forecasts.mae IS 'Mean Absolute Error';
COMMENT ON COLUMN forecasts.input_window IS 'Modele verilen girdi penceresi (saat)';

CREATE INDEX idx_forecasts_model_created ON forecasts (model_name, created_at DESC);
