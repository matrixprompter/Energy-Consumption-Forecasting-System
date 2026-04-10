-- Seed: Örnek test verileri (geliştirme ortamı için)
-- Gerçek veriler FAZ 2'de EPİAŞ API'den çekilecek

INSERT INTO energy_readings (timestamp, consumption_mwh, production_mwh, region, source, weather_temp, day_of_week, is_holiday)
VALUES
  ('2024-01-01 00:00:00+03', 28500.5, 29100.0, 'TR', 'epias', 5.2, 0, true),
  ('2024-01-01 01:00:00+03', 27200.3, 28000.0, 'TR', 'epias', 4.8, 0, true),
  ('2024-01-01 02:00:00+03', 26100.1, 27500.0, 'TR', 'epias', 4.5, 0, true),
  ('2024-01-01 03:00:00+03', 25500.0, 26800.0, 'TR', 'epias', 4.1, 0, true),
  ('2024-01-01 04:00:00+03', 25200.8, 26500.0, 'TR', 'epias', 3.9, 0, true),
  ('2024-01-01 05:00:00+03', 25800.2, 27000.0, 'TR', 'epias', 3.7, 0, true),
  ('2024-01-01 06:00:00+03', 27100.4, 28200.0, 'TR', 'epias', 3.5, 0, true),
  ('2024-01-01 07:00:00+03', 29500.7, 30100.0, 'TR', 'epias', 4.0, 0, true),
  ('2024-01-01 08:00:00+03', 32100.9, 33000.0, 'TR', 'epias', 5.1, 0, true),
  ('2024-01-01 09:00:00+03', 34200.6, 35000.0, 'TR', 'epias', 6.3, 0, true)
ON CONFLICT (timestamp) DO NOTHING;

INSERT INTO forecasts (model_name, forecast_horizon, predictions, mape, rmse, mae, input_window)
VALUES
  ('prophet', 24,
   '[{"timestamp":"2024-01-02T00:00:00+03:00","value":28600,"lower":27200,"upper":30000}]'::jsonb,
   4.2, 1250.5, 980.3, 720),
  ('xgboost', 24,
   '[{"timestamp":"2024-01-02T00:00:00+03:00","value":28450,"lower":27500,"upper":29400}]'::jsonb,
   3.8, 1100.2, 870.1, 720),
  ('sarima', 24,
   '[{"timestamp":"2024-01-02T00:00:00+03:00","value":28700,"lower":26800,"upper":30600}]'::jsonb,
   5.1, 1500.8, 1150.6, 720);

INSERT INTO model_comparisons (prophet_mape, xgboost_mape, sarima_mape, winner, dataset_period, notes)
VALUES
  (4.2, 3.8, 5.1, 'xgboost', '2024-01-01/2024-01-31', 'Ocak 2024 karşılaştırma — XGBoost en düşük MAPE');
