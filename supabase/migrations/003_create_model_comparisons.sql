-- P2-103: model_comparisons tablosu
-- 3 modelin karşılaştırmalı metriklerini saklar

CREATE TABLE IF NOT EXISTS model_comparisons (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at          timestamptz NOT NULL DEFAULT now(),
  prophet_mape    float8      NOT NULL,
  xgboost_mape    float8      NOT NULL,
  sarima_mape     float8      NOT NULL,
  winner          text        NOT NULL CHECK (winner IN ('prophet', 'xgboost', 'sarima')),
  dataset_period  text,
  notes           text
);

COMMENT ON TABLE model_comparisons IS 'Günlük model karşılaştırma sonuçları';
COMMENT ON COLUMN model_comparisons.winner IS 'En düşük MAPE değerine sahip model';
COMMENT ON COLUMN model_comparisons.dataset_period IS 'Değerlendirme dönemi (ör: 2024-01-01/2024-12-31)';

CREATE INDEX idx_model_comparisons_run_at ON model_comparisons (run_at DESC);
