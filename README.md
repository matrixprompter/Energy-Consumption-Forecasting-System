# Energy Consumption Forecasting System

**Prophet - XGBoost - SARIMA - Next.js 16 Dashboard**

A full-stack machine learning project that forecasts hourly energy consumption for Turkey using real EPİAŞ data, compares 3 ML models with fair rolling evaluation, and provides a Power BI-style interactive dashboard with guided onboarding, dark/light theme, and PDF/Excel/CSV export.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Python](https://img.shields.io/badge/Python-3.14-yellow?logo=python)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-green?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **3 ML Models** — Prophet, XGBoost (with SHAP explainability), SARIMA
- **14 Engineered Features** — lag values, rolling stats, weather, calendar features
- **Real EPİAŞ Data** — Live hourly consumption data from EPİAŞ Şeffaflık 2.0 API via `eptr2`
- **Fair Model Evaluation** — Rolling 24-step forecast windows (not one-step-ahead cheating)
- **Lazy-Load ML Models** — Context manager pattern for low-memory environments (Render free tier 512 MB)
- **Interactive Dashboard** — Chart.js with zoom/pan, real-time scenario analysis
- **Model Comparison Tabs** — "Son 24 Saat" (computed from live data) vs "Genel (7 Gün)" (test set)
- **Guided Onboarding Tour** — Step-by-step card-by-card walkthrough with blue highlight ring
- **Dark / Light Theme** — Custom theme provider with localStorage persistence
- **Export** — PDF reports (jsPDF), Excel workbooks (xlsx), CSV files
- **Turkish UI** — Full Turkish language support
- **Responsive** — Mobile-first design with Tailwind CSS 4
- **InfoTooltips** — Portal-rendered hover tooltips on every card (no overflow clipping)
- **Demo Mode** — Works offline with seeded deterministic data when ML API is unavailable
- **Supabase** — PostgreSQL with RLS policies, indexed queries, typed client

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16.2 (App Router, Turbopack) |
| Language | TypeScript 5.7 |
| Styling | Tailwind CSS 4 + shadcn/ui components |
| Charts | Chart.js 4 + react-chartjs-2 + chartjs-plugin-zoom |
| ML API | Python 3.14 + FastAPI 0.115 |
| Forecasting | Prophet, XGBoost, SARIMA (auto_arima) |
| Data Source | EPİAŞ Şeffaflık 2.0 (`eptr2`) + Open-Meteo |
| Database | Supabase (PostgreSQL 17) with RLS |
| Serialization | joblib (compress=3) for model persistence |
| Deployment | Vercel (Frontend) + Render (Python API) |

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (TR lang, suppressHydrationWarning)
│   │   ├── globals.css                # Tailwind CSS 4 + oklch theme tokens
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Dashboard shell (header, theme toggle, onboarding btn)
│   │   │   └── page.tsx               # Main dashboard (real data + demo fallback)
│   │   └── api/
│   │       ├── energy/route.ts        # GET /api/energy
│   │       ├── forecast/
│   │       │   ├── route.ts           # GET /api/forecast
│   │       │   ├── compare/route.ts   # GET /api/forecast/compare
│   │       │   └── scenario/route.ts  # POST /api/forecast/scenario
│   │       ├── models/route.ts        # GET /api/models
│   │       └── cron/
│   │           ├── update-data/route.ts   # Hourly EPİAŞ data fetch
│   │           └── run-forecast/route.ts  # Daily forecast refresh
│   ├── components/
│   │   ├── ForecastChart.tsx           # Line chart: actual vs predicted + confidence band
│   │   ├── ModelComparison.tsx         # Grouped bar with period tabs (24h / 7d)
│   │   ├── HeatmapChart.tsx            # 7x24 hourly consumption heatmap
│   │   ├── FeatureImportance.tsx       # SHAP horizontal bar chart
│   │   ├── ScenarioAnalysis.tsx        # What-if sliders + prediction
│   │   ├── ForecastTable.tsx           # Data table + color-coded errors + CSV export
│   │   ├── ExportPanel.tsx             # PDF / Excel / CSV export
│   │   ├── KPICards.tsx                # 4 summary metric cards
│   │   ├── OnboardingTour.tsx          # Guided step-by-step card tour
│   │   ├── OnboardingButton.tsx        # Header button to restart tour
│   │   ├── ThemeProvider.tsx           # Custom dark/light theme context
│   │   ├── ThemeToggle.tsx             # Theme switch button
│   │   └── ui/                         # shadcn/ui primitives
│   │       ├── card.tsx
│   │       ├── button.tsx
│   │       ├── select.tsx
│   │       ├── slider.tsx
│   │       ├── switch.tsx
│   │       └── info-tooltip.tsx        # Portal-rendered tooltip (createPortal)
│   ├── lib/
│   │   ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   │   ├── chart-setup.ts             # Chart.js registration + zoom plugin
│   │   └── supabase/
│   │       ├── client.ts              # Browser client (createBrowserClient)
│   │       ├── server.ts              # Server client (createServerClient)
│   │       └── admin.ts               # Service role client (RLS bypass)
│   └── types/database.ts              # Full DB TypeScript types
├── python/
│   ├── main.py                         # FastAPI app (lazy-load pattern, 7 endpoints)
│   ├── config.py                       # Environment configuration (.env.local support)
│   ├── data_collector.py               # EPİAŞ (eptr2) + Open-Meteo data collection
│   ├── feature_engineering.py          # 14-feature pipeline
│   ├── evaluate.py                     # Fair rolling evaluation + comparison charts
│   ├── requirements.txt                # Python dependencies
│   └── models/
│       ├── __init__.py                 # Model exports
│       ├── prophet_model.py            # Prophet + Turkish holidays
│       ├── xgboost_model.py            # XGBoost + SHAP + scenario
│       ├── sarima_model.py             # SARIMA + auto_arima (14-day window)
│       └── saved/                      # Trained model .pkl files (git-ignored)
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_energy_readings.sql
│   │   ├── 002_create_forecasts.sql
│   │   ├── 003_create_model_comparisons.sql
│   │   └── 004_rls_and_indexes.sql
│   ├── seed.sql
│   └── run_migrations.sh
├── vercel.json                         # Cron job configuration
├── .env.local.example                  # Environment variables template
├── LICENSE                             # MIT License
└── README.md
```

## Architecture

### Lazy-Load Model Pattern

The ML API uses a context manager to load models on-demand and free memory after use. This enables running 3 ML models on Render's free tier (512 MB RAM):

```python
@contextmanager
def load_model(model_name: str):
    model = joblib.load(MODEL_PATHS[model_name])
    try:
        yield model
    finally:
        del model
        gc.collect()

# Usage — model is loaded, used, then freed
with load_model("xgboost") as model:
    prediction = model.predict(X)
```

### Fair Model Evaluation

All 3 models are evaluated identically using rolling 24-step forecast windows on the test set. This prevents unfair advantages:

| Evaluation Issue | Problem | Our Fix |
|-----------------|---------|---------|
| XGBoost one-step-ahead | Uses real lag features (sees actual t-1) | Recursive multi-step: uses own predictions as lag |
| SARIMA full-horizon | Forecasts 400+ steps (degrades badly) | Rolling 24-step windows |
| Different test sizes | Each model tested differently | Same 7 windows x 24h for all |

### Data Flow

```
EPİAŞ Şeffaflık 2.0 API (eptr2)
        ↓
  data_collector.py → Supabase (energy_readings)
        ↓
  evaluate.py → Train models → joblib .pkl files
        ↓                    → Supabase (forecasts, model_comparisons)
        ↓
  FastAPI (main.py) ← lazy-load .pkl on request
        ↓
  Next.js Dashboard ← /forecast, /model-comparison, /feature-importance
```

## Database Schema

### energy_readings
Hourly energy consumption data sourced from EPİAŞ Şeffaflık 2.0 API.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated UUID |
| timestamp | timestamptz (UNIQUE) | Measurement time |
| consumption_mwh | float8 | Hourly consumption (MWh) |
| production_mwh | float8 | Hourly production (MWh) |
| region | text | Region code (default: TR) |
| source | text | Data source: epias, entsoe, kaggle |
| weather_temp | float8 | Hourly temperature (°C) |
| day_of_week | int | Day of week (0-6) |
| is_holiday | boolean | Public holiday flag |

### forecasts
ML model prediction results and error metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated UUID |
| model_name | text | prophet / xgboost / sarima |
| forecast_horizon | int | Forecast horizon (hours): 24, 48, 168 |
| predictions | jsonb | Prediction array: [{timestamp, value, lower, upper}] |
| mape | float8 | Mean Absolute Percentage Error (%) |
| rmse | float8 | Root Mean Square Error |
| mae | float8 | Mean Absolute Error |

### model_comparisons
Model comparison results from fair rolling evaluation.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated UUID |
| run_at | timestamptz | Comparison timestamp |
| prophet_mape | float8 | Prophet MAPE score |
| xgboost_mape | float8 | XGBoost MAPE score |
| sarima_mape | float8 | SARIMA MAPE score |
| winner | text | Model with lowest MAPE |

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/matrixprompter/Energy-Consumption-Forecasting-System.git
cd Energy-Consumption-Forecasting-System
npm install
```

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API > service_role |
| `SUPABASE_ACCESS_TOKENS` | Supabase > Access Tokens (migration/CLI) |
| `GITHUB_CLASSIC_TOKEN` | GitHub > Settings > Developer settings > Personal access tokens (Classic) |
| `EPIAS_USERNAME` | EPİAŞ Şeffaflık Portal login email |
| `EPIAS_PASSWORD` | EPİAŞ Şeffaflık Portal password |
| `ENTSOE_API_KEY` | ENTSO-E Transparency API token (opsiyonel) |
| `NEXT_PUBLIC_ML_API_URL` | Python FastAPI adresi (varsayılan: `http://localhost:8000`) |

### 3. Database Migration

Run migrations via Supabase SQL Editor in order:

```
001_create_energy_readings.sql  → energy_readings table
002_create_forecasts.sql        → forecasts table + index
003_create_model_comparisons.sql → model_comparisons table + index
004_rls_and_indexes.sql         → RLS policies + performance indexes
```

### 4. Run Dashboard

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the dashboard runs in **demo mode** with realistic seeded data when the ML API is offline.

### 5. Python ML Pipeline

```bash
cd python
pip install -r requirements.txt

# Collect real data from EPİAŞ (requires credentials)
python data_collector.py

# Train & evaluate all 3 models (fair rolling evaluation)
python evaluate.py

# Start FastAPI server (lazy-load mode)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

When the ML API is running, the dashboard automatically switches from demo mode to live data with a green "EPİAŞ + ML API" badge.

## API Endpoints

### Python FastAPI (ML Service)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health + available models list |
| POST | `/forecast` | Generate forecast (lazy-load model per request) |
| GET | `/latest-forecast` | Retrieve latest stored forecast results |
| GET | `/model-comparison` | Fair rolling evaluation metrics (7 x 24h windows) |
| GET | `/feature-importance` | XGBoost SHAP feature importance values |
| POST | `/update-data` | Fetch new data from EPİAŞ via eptr2 |
| POST | `/scenario` | What-if scenario analysis (XGBoost) |

### Next.js API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/energy` | List energy readings (with date/limit filters) |
| GET | `/api/forecast` | Get forecast results by model |
| GET | `/api/forecast/compare` | Model comparison history |
| POST | `/api/forecast/scenario` | Proxy to ML scenario endpoint |
| GET | `/api/models` | List models with latest metrics |
| GET | `/api/cron/update-data` | Cron: fetch new EPİAŞ data (hourly) |
| GET | `/api/cron/run-forecast` | Cron: refresh daily forecasts (06:00) |

## Dashboard Components

| Component | Description |
|-----------|-------------|
| **KPICards** | 4 summary cards: avg consumption, peak hour, best accuracy, winning model |
| **ForecastChart** | Line chart with actual vs predicted + 95% confidence band, zoom/pan enabled |
| **ModelComparison** | Grouped bar with **period tabs**: "Son 24 Saat" (live) vs "Genel 7 Gün" (test set) |
| **HeatmapChart** | 7-day x 24-hour consumption heatmap with auto peak detection (red outline) |
| **FeatureImportance** | Horizontal bar chart of XGBoost SHAP values (14 features) |
| **ScenarioAnalysis** | Interactive what-if: adjust temperature, hour, day, holiday |
| **ForecastTable** | Data table with color-coded error % (green <5%, yellow 5-10%, red >10%) |
| **ExportPanel** | Export as PDF report, Excel workbook, or CSV file |
| **OnboardingTour** | Guided step-by-step tour highlighting each card with blue ring |

## ML Models

| Model | MAPE | Description |
|-------|------|-------------|
| **XGBoost** | ~2.7% | Gradient boosting with 14 features, SHAP explainability, recursive multi-step forecasting |
| **Prophet** | ~4.8% | Meta's time series model with daily/yearly seasonality, Turkish holidays, weather regressor |
| **SARIMA** | ~23% | Statistical model with auto_arima, 14-day training window (336 hours) |

### Feature Engineering (14 Features)

| Feature | Description |
|---------|-------------|
| lag_1h, lag_24h, lag_168h | Lagged consumption (1 hour, 1 day, 1 week) |
| rolling_mean_24h, rolling_std_24h | 24-hour rolling mean and standard deviation |
| rolling_mean_168h, rolling_std_168h | 1-week rolling mean and standard deviation |
| hour | Hour of day (0-23) |
| day_of_week | Day of week (0-6) |
| month | Month (1-12) |
| season | Season (0=Winter, 1=Spring, 2=Summer, 3=Autumn) |
| is_holiday_int | Public holiday flag |
| is_weekend | Weekend flag |
| weather_temp | Hourly temperature (°C) from Open-Meteo |

## Security

- **Row Level Security (RLS)** enabled on all 3 tables
- `anon` role: SELECT only (dashboard reads)
- `authenticated` role: INSERT + UPDATE (data ingestion)
- `service_role`: full access (RLS bypass — server-side only)
- Service role key is **never** exposed to the browser
- Environment variables stored in `.env.local` (git-ignored)
- ML models loaded via lazy-load context manager (no persistent memory footprint)

## Data Sources

| Source | Description | Auth |
|--------|-------------|------|
| EPİAŞ Şeffaflık 2.0 | Real-time Turkish energy market data via `eptr2` library | Email + password (free registration) |
| Open-Meteo | Historical weather data (temperature) | No auth required |

## License

This project is licensed under the [MIT License](LICENSE).
