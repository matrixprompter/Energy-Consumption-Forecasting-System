# Energy Consumption Forecasting System

**Real-time ML-powered energy demand forecasting for Turkey's national grid**

End-to-end machine learning platform that ingests live data from EPİAŞ (Turkey's Energy Exchange), trains Prophet and XGBoost models on 1 year of hourly consumption history (~8,760 data points), and serves predictions through a production-grade interactive dashboard. The system performs fair rolling 24-step forecast evaluation across 6 time periods and provides full model explainability via SHAP analysis.

![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Python](https://img.shields.io/badge/Python-3.14-yellow?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_17-green?logo=supabase)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Highlights

- **2 Production ML Models** — Prophet (time series decomposition + Turkish holidays) and XGBoost (gradient boosting + 14 engineered features + SHAP explainability)
- **1 Year of Real Data** — ~8,760 hourly records from EPİAŞ Şeffaflık 2.0 API via `eptr2` library
- **Fair Multi-Period Evaluation** — Rolling 24-step forecast windows across 6 periods (1 day → 1 year), each with independent winner determination
- **Memory-Efficient Serving** — Lazy-load context manager pattern loads one model at a time, enabling deployment on 512 MB RAM (Render free tier)
- **Full-Stack Dashboard** — Next.js 16 App Router with real-time KPIs, interactive charts, heatmaps, scenario analysis, and multi-format export
- **Graceful Degradation** — Dashboard operates in demo mode with deterministic seeded data when ML API is unavailable
- **Model Transparency** — Color-coded metric comparison (green = winner, red = loser), per-metric tooltips, and technical evaluation methodology note

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16.2 (App Router, Turbopack), TypeScript 5.7 |
| **Styling** | Tailwind CSS 4, shadcn/ui component library |
| **Visualization** | Chart.js 4 + react-chartjs-2 + chartjs-plugin-zoom |
| **ML API** | Python 3.14, FastAPI 0.115, Uvicorn |
| **Forecasting** | Prophet (Meta), XGBoost + SHAP |
| **Data Source** | EPİAŞ Şeffaflık 2.0 (`eptr2`), Open-Meteo (weather) |
| **Database** | Supabase (PostgreSQL 17) with Row Level Security |
| **Model Persistence** | joblib (compress=3) |
| **Export** | jsPDF (PDF reports), xlsx (Excel workbooks), CSV |
| **Deployment** | Vercel (Frontend) + Render (Python API) |

---

## Architecture

### System Overview

```
EPİAŞ Şeffaflık 2.0 API          Open-Meteo API
        │                              │
        └──────────┬───────────────────┘
                   ▼
          data_collector.py
                   │
                   ▼
        ┌─────────────────────┐
        │  Supabase PostgreSQL │
        │  energy_readings     │
        │  forecasts           │
        │  model_comparisons   │
        └─────────┬───────────┘
                  │
        ┌─────────▼───────────┐
        │    evaluate.py       │
        │  ┌───────┐ ┌──────┐ │
        │  │Prophet│ │XGBst │ │     6 Period Evaluation
        │  └───┬───┘ └──┬───┘ │     1d, 7d, 30d, 90d, 180d, 1y
        │      └────┬────┘    │     Rolling 24-step windows
        │           ▼         │
        │    .pkl model files  │
        │    comparison results│
        └─────────┬───────────┘
                  │
        ┌─────────▼───────────┐
        │  FastAPI (main.py)   │
        │  Lazy-load models    │     One model in memory at a time
        │  7 REST endpoints    │     gc.collect() after each request
        └─────────┬───────────┘
                  │
        ┌─────────▼───────────┐
        │  Next.js 16 Dashboard│
        │  Real-time KPIs      │     Auto-detects API availability
        │  Interactive charts  │     Falls back to demo mode
        │  Multi-format export │
        └─────────────────────┘
```

### Lazy-Load Model Pattern

Models are loaded on-demand per request and freed immediately after use. This prevents out-of-memory crashes on constrained environments:

```python
@contextmanager
def load_model(model_name: str):
    model = joblib.load(MODEL_PATHS[model_name])
    try:
        yield model
    finally:
        del model
        gc.collect()

# Model loaded → used → garbage collected
with load_model("xgboost") as model:
    prediction = model.predict(X)
# Memory freed here
```

### Fair Rolling Evaluation

Both models are evaluated identically using rolling 24-step forecast windows. XGBoost uses recursive multi-step prediction (feeds its own outputs as lag features), preventing unfair advantage over Prophet:

| Common Pitfall | Problem | Solution Applied |
|---------------|---------|-----------------|
| One-step-ahead XGBoost | Uses real lag values (sees actual t-1) | Recursive: uses own predictions as lag inputs |
| Single test window | One lucky/unlucky window skews results | Multiple rolling windows across test set |
| Same period for all | Short-term model wins unfairly | 6 independent periods, each with own winner |
| Mismatched test sets | Models tested on different data | Same windows, same data, same metrics |

### Multi-Period Evaluation System

Each period evaluates models independently — a model that excels at 1-day forecasting may underperform at 6-month horizon:

| Period | Label | Test Hours | Use Case |
|--------|-------|-----------|----------|
| 1d | 1 Gün | 24 | Short-term operational planning |
| 7d | 7 Gün | 168 | Weekly demand scheduling |
| 30d | 1 Ay | 720 | Monthly capacity planning |
| 90d | 3 Ay | 2,160 | Seasonal trend analysis |
| 180d | 6 Ay | 4,320 | Semi-annual forecasting |
| 1y | 1 Yıl | 8,760 | Annual strategic planning |

---

## Dashboard Components

### KPI Cards
Four summary cards computed from live data: average consumption (MWh), peak demand hour, best model accuracy (MAPE %), and winning model name. KPIs dynamically update based on the selected period filter.

### Forecast Chart
Interactive line chart with actual vs. predicted values and 95% confidence band. Supports zoom/pan via mouse wheel and drag. Model selector switches between Prophet and XGBoost predictions.

### Model Comparison
Metric table comparing Prophet and XGBoost across MAPE, RMSE, MAE, and R². Green cells highlight the winner per metric, red cells highlight the loser. Period tabs (Son 24 Saat, 1 Gün through 1 Yıl) switch between time windows. Includes a technical note explaining the rolling evaluation methodology.

### Heatmap
7-day x 24-hour consumption heatmap. Color intensity scales from light (low demand) to dark blue (high demand). Peak cell highlighted with red outline. Cells with no data display "-" instead of misleading zeros.

### Feature Importance
Horizontal bar chart of XGBoost SHAP values for all 14 engineered features. Shows which features drive predictions most (lag_1h and lag_24h typically dominate).

### Scenario Analysis
Interactive what-if tool: adjust temperature, hour, day of week, and holiday flag via sliders and switches. XGBoost predicts consumption for the configured scenario in real-time.

### Forecast Table
Scrollable data table with independent period filter (Son 24 Saat through 1 Yıl). Each period fetches its own data from Supabase. Columns: timestamp, actual consumption, Prophet prediction, Prophet error %, XGBoost prediction, XGBoost error %. Error cells are color-coded: green (<5%), yellow (5-10%), red (>10%). Sticky header, CSV export per selected period.

### Export Panel
Multi-format export: PDF report (jsPDF with charts and metrics summary), Excel workbook (xlsx with structured sheets), and raw CSV. Export reflects the currently selected period and model data.

---

## ML Models

### XGBoost
Gradient boosted decision tree ensemble trained on 14 engineered features. Uses recursive multi-step forecasting for fair evaluation. SHAP (SHapley Additive exPlanations) provides per-feature contribution analysis. Supports scenario prediction via `predict_scenario()`.

### Prophet
Meta's additive time series decomposition model. Configured with daily and yearly seasonality components, Turkish public holidays (`holidays` package), and weather temperature as external regressor. Outputs prediction intervals natively.

### Feature Engineering Pipeline (14 Features)

| Category | Features | Description |
|----------|----------|-------------|
| **Lag** | lag_1h, lag_24h, lag_168h | Past consumption at 1 hour, 1 day, 1 week |
| **Rolling** | rolling_mean_24h, rolling_std_24h | 24-hour rolling statistics |
| **Rolling** | rolling_mean_168h, rolling_std_168h | 1-week rolling statistics |
| **Time** | hour, day_of_week, month | Temporal position features |
| **Calendar** | season, is_weekend, is_holiday_int | Categorical time features |
| **Weather** | weather_temp | Hourly temperature (°C) from Open-Meteo |

### Model Performance (1-Year Training Data)

| Period | XGBoost MAPE | Prophet MAPE | Winner |
|--------|-------------|-------------|--------|
| 1 Gün | ~1.4% | ~3.5% | XGBoost |
| 7 Gün | ~1.8% | ~5.2% | XGBoost |
| 1 Ay | ~2.1% | ~12.8% | XGBoost |
| 3 Ay | ~2.8% | ~38.6% | XGBoost |
| 6 Ay | ~3.2% | ~72.4% | XGBoost |
| 1 Yıl | ~3.7% | ~103.6% | XGBoost |

> Prophet's additive decomposition degrades significantly over longer horizons where lag-based features become critical. XGBoost's recursive strategy maintains sub-4% MAPE even at 1-year scale.

---

## Project Structure

```
.
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout (TR locale, theme suppression)
│   │   ├── globals.css                # Tailwind CSS 4 + oklch theme tokens
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx             # Dashboard shell (header, theme, onboarding)
│   │   │   └── page.tsx               # Main dashboard (data loading, state, KPIs)
│   │   └── api/
│   │       ├── energy/route.ts        # GET /api/energy (Supabase query)
│   │       ├── forecast/
│   │       │   ├── route.ts           # GET /api/forecast
│   │       │   ├── compare/route.ts   # GET /api/forecast/compare
│   │       │   └── scenario/route.ts  # POST /api/forecast/scenario
│   │       ├── models/route.ts        # GET /api/models
│   │       └── cron/
│   │           ├── update-data/       # Hourly EPİAŞ data ingestion
│   │           └── run-forecast/      # Daily forecast refresh (06:00 UTC)
│   ├── components/
│   │   ├── ForecastChart.tsx           # Line chart + confidence band + zoom/pan
│   │   ├── ModelComparison.tsx         # Metric table + period tabs + color coding
│   │   ├── HeatmapChart.tsx            # 7x24 heatmap + peak detection
│   │   ├── FeatureImportance.tsx       # SHAP horizontal bar chart
│   │   ├── ScenarioAnalysis.tsx        # What-if sliders + live prediction
│   │   ├── ForecastTable.tsx           # Data table + independent period filter
│   │   ├── ExportPanel.tsx             # PDF / Excel / CSV export
│   │   ├── KPICards.tsx                # 4 dynamic summary cards
│   │   ├── OnboardingTour.tsx          # Guided walkthrough (blue highlight ring)
│   │   └── ui/                         # shadcn/ui primitives (card, button, etc.)
│   ├── lib/
│   │   ├── utils.ts                    # cn() helper (clsx + tailwind-merge)
│   │   ├── chart-setup.ts             # Chart.js registration + zoom plugin
│   │   └── supabase/                  # Browser, server, and admin clients
│   └── types/database.ts              # Full Supabase TypeScript types
├── python/
│   ├── main.py                         # FastAPI (7 endpoints, lazy-load pattern)
│   ├── config.py                       # Environment configuration
│   ├── data_collector.py               # EPİAŞ + Open-Meteo data pipeline
│   ├── feature_engineering.py          # 14-feature engineering pipeline
│   ├── evaluate.py                     # Multi-period rolling evaluation
│   ├── requirements.txt                # Python dependencies
│   └── models/
│       ├── __init__.py                 # Model exports (Prophet, XGBoost)
│       ├── prophet_model.py            # Prophet + Turkish holidays
│       ├── xgboost_model.py            # XGBoost + SHAP + scenario analysis
│       └── saved/                      # Trained .pkl files (git-ignored)
├── supabase/
│   └── migrations/                    # SQL migration files (4 scripts)
├── vercel.json                         # Cron job schedules
├── .env.local.example                  # Environment variable template
└── README.md
```

---

## Database Schema

### energy_readings
Hourly energy consumption data from EPİAŞ Şeffaflık 2.0 API.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| timestamp | timestamptz (UNIQUE) | Measurement time (UTC) |
| consumption_mwh | float8 | Hourly consumption (MWh) |
| production_mwh | float8 | Hourly production (MWh) |
| region | text | Region code (default: TR) |
| source | text | Data source identifier |
| weather_temp | float8 | Temperature (°C) |
| day_of_week | int | 0 (Monday) - 6 (Sunday) |
| is_holiday | boolean | Turkish public holiday flag |

### forecasts
Model prediction results with error metrics.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| model_name | text | prophet / xgboost |
| forecast_horizon | int | Hours ahead: 24, 48, 168 |
| predictions | jsonb | [{timestamp, value, lower, upper}] |
| mape, rmse, mae | float8 | Error metrics |

### model_comparisons
Per-period evaluation results from rolling forecast windows.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| run_at | timestamptz | Evaluation timestamp |
| dataset_period | text | Period key: 1d, 7d, 30d, 90d, 180d, 1y |
| prophet_mape | float8 | Prophet MAPE for this period |
| xgboost_mape | float8 | XGBoost MAPE for this period |
| winner | text | Best model for this period |
| notes | jsonb | Full metrics (MAPE, RMSE, MAE, R²) per model |

---

## API Endpoints

### Python FastAPI (ML Service — port 8000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check + available models |
| POST | `/forecast` | Generate forecast (model loaded per request) |
| GET | `/latest-forecast` | Latest stored forecast results |
| GET | `/model-comparison?period=7d` | Single period comparison metrics |
| GET | `/model-comparison/all` | All 6 periods in one response |
| GET | `/feature-importance` | XGBoost SHAP values (lazy-load) |
| POST | `/update-data` | Ingest new EPİAŞ data |
| POST | `/scenario` | What-if scenario prediction |

### Next.js API Routes (port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/energy?from=&to=&limit=` | Energy readings with date filters |
| GET | `/api/forecast?model=` | Forecast by model name |
| GET | `/api/forecast/compare` | Comparison history |
| POST | `/api/forecast/scenario` | Proxy to ML scenario endpoint |
| GET | `/api/cron/update-data` | Hourly data ingestion (Vercel Cron) |
| GET | `/api/cron/run-forecast` | Daily forecast refresh (06:00 UTC) |

---

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

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `EPIAS_USERNAME` | EPİAŞ Şeffaflık Portal email |
| `EPIAS_PASSWORD` | EPİAŞ Şeffaflık Portal password |
| `NEXT_PUBLIC_ML_API_URL` | FastAPI address (default: `http://localhost:8000`) |

### 3. Database Setup

Run migration scripts in Supabase SQL Editor in order:
```
001_create_energy_readings.sql
002_create_forecasts.sql
003_create_model_comparisons.sql
004_rls_and_indexes.sql
```

### 4. Start Dashboard

```bash
npm run dev
```

Dashboard runs at [http://localhost:3000](http://localhost:3000) in **demo mode** with realistic seeded data. Green badge appears when ML API connects.

### 5. ML Pipeline

```bash
cd python
pip install -r requirements.txt

# Collect 1 year of EPİAŞ data
python data_collector.py

# Train models + run 6-period evaluation
python evaluate.py

# Start API server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## Security

- **Row Level Security (RLS)** on all tables — `anon` gets SELECT only, `service_role` bypasses RLS server-side
- Service role key never exposed to browser
- Environment variables in `.env.local` (git-ignored)
- CORS configured per environment
- Models loaded transiently via context manager — no persistent sensitive state in memory

## Data Sources

| Source | Data | Authentication |
|--------|------|---------------|
| EPİAŞ Şeffaflık 2.0 | Hourly consumption/production (MWh) | Email + password (free) |
| Open-Meteo | Hourly temperature (°C) | None required |

---

## License

This project is licensed under the [MIT License](LICENSE).
