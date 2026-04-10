/**
 * Supabase veritabanı TypeScript tip tanımları
 * FAZ 1 — energy_readings, forecasts, model_comparisons
 */

export type Database = {
  public: {
    Tables: {
      energy_readings: {
        Row: {
          id: string;
          timestamp: string;
          consumption_mwh: number;
          production_mwh: number | null;
          region: string;
          source: string;
          weather_temp: number | null;
          day_of_week: number;
          is_holiday: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          timestamp: string;
          consumption_mwh: number;
          production_mwh?: number | null;
          region?: string;
          source?: string;
          weather_temp?: number | null;
          day_of_week: number;
          is_holiday?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          timestamp?: string;
          consumption_mwh?: number;
          production_mwh?: number | null;
          region?: string;
          source?: string;
          weather_temp?: number | null;
          day_of_week?: number;
          is_holiday?: boolean;
          created_at?: string;
        };
      };
      forecasts: {
        Row: {
          id: string;
          created_at: string;
          model_name: "prophet" | "xgboost" | "sarima";
          forecast_horizon: number;
          predictions: ForecastPrediction[];
          mape: number | null;
          rmse: number | null;
          mae: number | null;
          input_window: number | null;
          metadata: Record<string, unknown>;
        };
        Insert: {
          id?: string;
          created_at?: string;
          model_name: "prophet" | "xgboost" | "sarima";
          forecast_horizon: number;
          predictions: ForecastPrediction[];
          mape?: number | null;
          rmse?: number | null;
          mae?: number | null;
          input_window?: number | null;
          metadata?: Record<string, unknown>;
        };
        Update: {
          id?: string;
          created_at?: string;
          model_name?: "prophet" | "xgboost" | "sarima";
          forecast_horizon?: number;
          predictions?: ForecastPrediction[];
          mape?: number | null;
          rmse?: number | null;
          mae?: number | null;
          input_window?: number | null;
          metadata?: Record<string, unknown>;
        };
      };
      model_comparisons: {
        Row: {
          id: string;
          run_at: string;
          prophet_mape: number;
          xgboost_mape: number;
          sarima_mape: number;
          winner: "prophet" | "xgboost" | "sarima";
          dataset_period: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          run_at?: string;
          prophet_mape: number;
          xgboost_mape: number;
          sarima_mape: number;
          winner: "prophet" | "xgboost" | "sarima";
          dataset_period?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          run_at?: string;
          prophet_mape?: number;
          xgboost_mape?: number;
          sarima_mape?: number;
          winner?: "prophet" | "xgboost" | "sarima";
          dataset_period?: string | null;
          notes?: string | null;
        };
      };
    };
  };
};

/** Tahmin dizisindeki tek bir nokta */
export type ForecastPrediction = {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
};

/** Kısayol tipler */
export type EnergyReading = Database["public"]["Tables"]["energy_readings"]["Row"];
export type EnergyReadingInsert = Database["public"]["Tables"]["energy_readings"]["Insert"];
export type Forecast = Database["public"]["Tables"]["forecasts"]["Row"];
export type ForecastInsert = Database["public"]["Tables"]["forecasts"]["Insert"];
export type ModelComparison = Database["public"]["Tables"]["model_comparisons"]["Row"];
export type ModelComparisonInsert = Database["public"]["Tables"]["model_comparisons"]["Insert"];
export type ModelName = "prophet" | "xgboost" | "sarima";
