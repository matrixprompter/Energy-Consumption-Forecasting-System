# Energy Consumption Forecasting System

**Prophet - XGBoost - SARIMA - Next.js 16 Dashboard**

A full-stack machine learning project that forecasts hourly energy consumption for Turkey, compares 3 ML models, and provides a Power BI-style interactive dashboard with guided onboarding, dark/light theme, and PDF/Excel/CSV export.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Python](https://img.shields.io/badge/Python-3.14-yellow?logo=python)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-green?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **3 ML Models** — Prophet, XGBoost (with SHAP explainability), SARIMA
- **14 Engineered Features** — lag values, rolling stats, weather, calendar features
- **Interactive Dashboard** — Chart.js with zoom/pan, real-time scenario analysis
- **Guided Onboarding Tour** — Step-by-step card-by-card walkthrough with blue highlight ring
- **Dark / Light Theme** — Custom theme provider with localStorage persistence
- **Export** — PDF reports (jsPDF), Excel workbooks (xlsx), CSV files
- **Turkish UI** — Full Turkish language support (ç, ı, ş, ö, ü, ğ)
- **Responsive** — Mobile-first design with Tailwind CSS 4
- **InfoTooltips** — Hover tooltips on every card explaining data and metrics
- **Demo Mode** — Works offline with seeded deterministic data (no hydration mismatch)
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
| Database | Supabase (PostgreSQL 17) with RLS |
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
│   │   │   └── page.tsx               # Main dashboard (demo data, API check)
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
│   │   ├── ModelComparison.tsx         # Grouped bar: 3 models x 4 metrics
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
│   │       └── info-tooltip.tsx        # Hover tooltip with info icon
│   ├── lib/
│   │   ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   │   ├── chart-setup.ts             # Chart.js registration + zoom plugin
│   │   └── supabase/
│   │       ├── client.ts              # Browser client (createBrowserClient)
│   │       ├── server.ts              # Server client (createServerClient)
│   │       └── admin.ts               # Service role client (RLS bypass)
│   └── types/database.ts              # Full DB TypeScript types
├── python/
│   ├── main.py                         # FastAPI app (7 endpoints)
│   ├── config.py                       # Environment configuration
│   ├── data_collector.py               # EPİAŞ + Open-Meteo data collection
│   ├── feature_engineering.py          # 14-feature pipeline
│   ├── evaluate.py                     # Model evaluation + comparison charts
│   ├── requirements.txt                # Python dependencies
│   └── models/
│       ├── prophet_model.py            # Prophet + Turkish holidays
│       ├── xgboost_model.py            # XGBoost + SHAP + scenario
│       └── sarima_model.py             # SARIMA + auto_arima
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_energy_readings.sql
│   │   ├── 002_create_forecasts.sql
│   │   ├── 003_create_model_comparisons.sql
│   │   └── 004_rls_and_indexes.sql
│   ├── seed.sql
│   └── run_migrations.sh
├── project-plan/                       # Project plan document
├── vercel.json                         # Cron job configuration
├── .env.local.example                  # Environment variables template
├── LICENSE                             # MIT License
└── README.md
```

## Database Schema

### energy_readings
Hourly energy consumption and production data sourced from EPİAŞ / ENTSO-E.

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
Daily model comparison results.

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
git clone https://github.com/matrixprompter/Energy-Forecast-System.git
cd Energy-Forecast-System
npm install
```

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` with your Supabase credentials:
- **NEXT_PUBLIC_SUPABASE_URL** — Supabase > Settings > API > Project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** — Supabase > Settings > API > anon public
- **SUPABASE_SERVICE_ROLE_KEY** — Supabase > Settings > API > service_role

### 3. Database Migration

Migrations are executed via the Supabase Management API or SQL Editor. Run in order:

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

### 5. Python ML Pipeline (Optional)

```bash
cd python
pip install -r requirements.txt

# Collect data from EPİAŞ
python data_collector.py

# Train & evaluate all 3 models
python evaluate.py

# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Python FastAPI (ML Service)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/forecast` | Generate time series forecast |
| GET | `/latest-forecast` | Retrieve latest forecast results |
| GET | `/model-comparison` | Compare metrics across 3 models |
| GET | `/feature-importance` | XGBoost SHAP feature importance |
| POST | `/update-data` | Fetch new data from EPİAŞ |
| POST | `/scenario` | What-if scenario analysis |

### Next.js API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/energy` | List energy readings (with filters) |
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
| **ModelComparison** | Grouped bar comparing Prophet, XGBoost, SARIMA across MAPE, RMSE, MAE, R² |
| **HeatmapChart** | 7-day x 24-hour consumption heatmap with auto peak detection (red outline) |
| **FeatureImportance** | Horizontal bar chart of XGBoost SHAP values (14 features) |
| **ScenarioAnalysis** | Interactive what-if: adjust temperature, hour, day, holiday → get prediction |
| **ForecastTable** | Data table with color-coded error % (green <5%, yellow 5-10%, red >10%) |
| **ExportPanel** | Export as PDF report, Excel workbook, or CSV file with data preview |
| **OnboardingTour** | Guided step-by-step tour highlighting each card with blue ring |

## ML Models

| Model | Description | Key Features |
|-------|-------------|--------------|
| **Prophet** | Meta's time series model | Daily + yearly seasonality, Turkish holidays, weather regressor, 95% confidence intervals |
| **XGBoost** | Gradient boosting regressor | 14 engineered features, SHAP explainability, scenario prediction, 500 trees |
| **SARIMA** | Statistical time series model | auto_arima parameter selection, last 2000 data points for speed |

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

## Data Sources

| Source | URL | Registration |
|--------|-----|--------------|
| EPİAŞ | seffaflik.epias.com.tr | Not required |
| ENTSO-E | transparency.entsoe.eu | Free registration + API token |
| Open-Meteo | open-meteo.com | Not required |

## License

This project is licensed under the [MIT License](LICENSE).
