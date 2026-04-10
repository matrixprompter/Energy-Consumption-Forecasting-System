-- P2-101: energy_readings tablosu
-- Saatlik enerji tüketim/üretim verilerini saklar (EPİAŞ / ENTSO-E kaynaklı)

CREATE TABLE IF NOT EXISTS energy_readings (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp     timestamptz   NOT NULL UNIQUE,
  consumption_mwh float8      NOT NULL,
  production_mwh  float8,
  region        text          NOT NULL DEFAULT 'TR',
  source        text          NOT NULL DEFAULT 'epias',
  weather_temp  float8,
  day_of_week   int           NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_holiday    boolean       NOT NULL DEFAULT false,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE energy_readings IS 'Saatlik enerji tüketim ve üretim verileri';
COMMENT ON COLUMN energy_readings.consumption_mwh IS 'Saatlik tüketim (MWh)';
COMMENT ON COLUMN energy_readings.production_mwh IS 'Saatlik üretim (MWh)';
COMMENT ON COLUMN energy_readings.source IS 'Veri kaynağı: epias, entsoe, kaggle';
COMMENT ON COLUMN energy_readings.weather_temp IS 'Saat bazlı hava sıcaklığı (°C) — Open-Meteo';
