-- P2-104: Row Level Security & Performans Indexleri

-- =============================================
-- INDEX: energy_readings
-- =============================================
CREATE INDEX idx_energy_readings_timestamp ON energy_readings (timestamp DESC);
CREATE INDEX idx_energy_readings_region ON energy_readings (region);
CREATE INDEX idx_energy_readings_region_timestamp ON energy_readings (region, timestamp DESC);

-- =============================================
-- RLS: energy_readings
-- =============================================
ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;

-- anon kullanıcılar sadece okuyabilir (dashboard için)
CREATE POLICY "energy_readings_anon_select"
  ON energy_readings
  FOR SELECT
  TO anon
  USING (true);

-- authenticated kullanıcılar veri ekleyebilir (data collector için)
CREATE POLICY "energy_readings_authenticated_insert"
  ON energy_readings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- authenticated kullanıcılar güncelleyebilir
CREATE POLICY "energy_readings_authenticated_update"
  ON energy_readings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- service_role her şeye erişir (RLS'yi bypass eder, ayrıca policy gerekmez)

-- =============================================
-- RLS: forecasts
-- =============================================
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forecasts_anon_select"
  ON forecasts
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "forecasts_authenticated_insert"
  ON forecasts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =============================================
-- RLS: model_comparisons
-- =============================================
ALTER TABLE model_comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_comparisons_anon_select"
  ON model_comparisons
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "model_comparisons_authenticated_insert"
  ON model_comparisons
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
