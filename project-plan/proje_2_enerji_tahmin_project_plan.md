# Proje 2 — Enerji Tüketim Tahmin Sistemi

**Prophet · XGBoost · SARIMA · Next.js Dashboard**

Eren Enerji — YZ Uzmanı Başvuru Portföyü

---

## Proje Özeti

| Alan | Detay |
|------|-------|
| Proje Adı | Enerji Tüketim Tahmin Sistemi |
| Teknoloji | Next.js 16.2 · Python 3.14 · FastAPI · Prophet · XGBoost · Supabase |
| Veri Seti | ENTSO-E / EPİAŞ (ücretsiz) + Açık enerji veri setleri |
| Deployment | Vercel + Render (Python) |
| Süre | ~5-6 gün (Claude Code ile) |
| Hedef | Saatlik enerji tüketimi tahmin et, 3 modeli karşılaştır, Power BI benzeri dashboard |

---

## Teknik Stack

| Katman | Teknoloji | Versiyon |
|--------|-----------|----------|
| Frontend | Next.js (App Router) | 16.2 |
| Dil | TypeScript | 5.7 |
| Stil | Tailwind CSS + shadcn/ui | 4.0 |
| Grafikler | Chart.js + react-chartjs-2 | 4.4 / 5.2 |
| ML API | Python + FastAPI | 3.14 / 0.115 |

> **Python 3.14 Uyumluluk Notu:** Python 3.14 bazı ML kütüphaneleri (scikit-learn, PyTorch, FastAPI) için henüz tüm wheel paketleri bulunmayabilir. Başlamadan önce `python -m pip install --upgrade pip` çalıştır. Sorun çıkarsa `pyenv install 3.13.12` ile 3.13'e dön.
| Tahmin Modelleri | Prophet · XGBoost · SARIMA | latest |
| Veritabanı | Supabase | latest |
| Tema | next-themes | 0.4 |

> **Next.js 16.2 Notları:** Turbopack artık varsayılan bundler (webpack yerine). React Compiler stable geldi (otomatik memoization). Cache Components ile yeni önbellekleme modeli. React 19.2 desteği mevcut (View Transitions, useEffectEvent). Claude Code başlangıç promptuna `--turbopack` flag'i eklemene gerek yok — artık default.
| İkonlar | lucide-react | 0.468 |

---

## Veri Seti — Nasıl Alınır?

### ENTSO-E (Avrupa Enerji Verisi — ÜCRETSİZ ama kayıt gerekir)
- **URL:** https://transparency.entsoe.eu
- **Kayıt:** Register → email doğrula → API token al (Hesabım → Web API Security Token)
- Python ile veri çekme: `pip install entsoe-py`
- Türkiye için: `country_code="TR"` → saatlik yük verisi (2015'ten günümüze)

### EPİAŞ (Türkiye Enerji Verisi — KAYIT GEREKMİYOR)
- **URL:** https://seffaflik.epias.com.tr
- REST API direkt çalışır:
  ```
  GET https://seffaflik.epias.com.tr/transparency/service/consumption/real-time-consumption
  ```
- Saatlik tüketim, yük tahmini, üretim verileri — hepsi ücretsiz JSON

### Kaggle (Alternatif)
- kaggle.com/datasets → "hourly energy consumption" ara → AEP Hourly (10 yıl, ABD)
- `kaggle datasets download -d robikscube/hourly-energy-consumption`

---

## API Anahtarları — Claude Code Senden Bunları İsteyecek

| Değişken | Nereden Alınır |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | supabase.com → Proje → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | supabase.com → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | supabase.com → Settings → API → service_role |
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens → Generate |
| `GITHUB_CLASSIC_TOKEN` | github.com → Settings → Developer settings → Tokens (classic) → repo+workflow |
| `ENTSOE_API_KEY` | transparency.entsoe.eu → Register → Hesabım → Web API Security Token |
| `ML_API_URL` | Render deploy sonrası: `https://xxx.render.com` (FAZ 4'te alınır) |

---

## API Uç Noktaları (Endpoints)

### Python FastAPI — Tahmin Servisi

| Metod | Endpoint | Açıklama | Request Body | Response |
|-------|----------|----------|--------------|----------|
| `POST` | `/forecast` | Zaman serisi tahmini | `{"model": "prophet/xgboost/sarima", "horizon": 24/48/168, "region": "TR"}` | `{"predictions": [...], "confidence": {"lower": [...], "upper": [...]}, "mape": float}` |
| `GET` | `/latest-forecast` | En son tahmin sonuçları | `?model=&region=` | `{"forecast": [...], "generated_at": "..."}` |
| `GET` | `/model-comparison` | 3 modelin metrik karşılaştırması | — | `{"prophet": {mape, rmse, mae}, "xgboost": {...}, "sarima": {...}, "winner": "string"}` |
| `GET` | `/feature-importance` | XGBoost SHAP değerleri | — | `{"features": [{"name": "string", "shap_value": float}]}` |
| `POST` | `/update-data` | EPİAŞ'tan yeni veri çek, DB'ye kaydet | `{"from_date": "ISO", "to_date": "ISO"}` | `{"rows_inserted": int, "status": "ok"}` |
| `GET` | `/health` | Servis sağlık kontrolü | — | `{"status": "healthy", "models_loaded": [...]}` |

### Next.js API Routes

| Metod | Endpoint | Açıklama | Query Params | Response |
|-------|----------|----------|-------------|----------|
| `GET` | `/api/energy` | Enerji okumalarını listele | `?from=&to=&region=&limit=` | `{"data": [...], "total": int}` |
| `GET` | `/api/forecast` | Tahmin sonuçlarını getir | `?model=&horizon=` | `{"data": [...]}` |
| `GET` | `/api/forecast/compare` | 3 model karşılaştırması | `?period=7d/30d/90d` | `{"comparison": {...}}` |
| `POST` | `/api/forecast/scenario` | Senaryo analizi (parametre değiştir) | — | `{"scenario_id", "temp", "is_holiday", "hour"}` → `{"prediction": float}` |
| `GET` | `/api/models` | Model kayıtlarını listele | — | `{"models": [...]}` |
| `POST` | `/api/export/pdf` | Dashboard'u PDF'e aktar | `{"chart_ids": [...], "period": "string"}` | PDF binary |
| `POST` | `/api/export/excel` | Tahmin verilerini Excel'e aktar | `{"model": "string", "period": "string"}` | XLSX binary |

### Vercel Cron Endpoints

| Endpoint | Schedule | Açıklama |
|----------|----------|----------|
| `GET /api/cron/update-data` | `0 * * * *` (her saat) | EPİAŞ'tan yeni veri çek, Supabase'e kaydet |
| `GET /api/cron/run-forecast` | `0 6 * * *` (her sabah 06:00) | Günlük tahminleri yenile, model_comparisons tablosunu güncelle |

---

## Proje Planı — Fazlar ve Görevler

### FAZ 0 — Kurulum

| Task ID | Görev Adı | Detay |
|---------|-----------|-------|
| P2-000 | Claude Code ile İskelet | `claude "Create Next.js 16.2 project energy-forecast-dashboard with TypeScript, Tailwind CSS 4, shadcn/ui, Chart.js. Include FastAPI Python backend in /python folder. Setup Supabase client."` |
| P2-001 | EPİAŞ API Testi | `curl "https://seffaflik.epias.com.tr/transparency/service/consumption/real-time-consumption?startDate=2024-01-01T00:00:00&endDate=2024-01-07T00:00:00"` — kayıt gerekmez, direkt çalışır. |
| P2-002 | ENTSO-E Kaydı | transparency.entsoe.eu → Register → Email doğrula → Hesap → Web API Security Token → kopyala → `.env`'e `ENTSOE_API_KEY` ekle. |
| P2-003 | Supabase & GitHub Kurulum | Yeni proje: "energy-forecast-db". Token'lar hazırsa tekrar almaya gerek yok. |

---

### FAZ 1 — Supabase Veritabanı

**Migration API Pattern:**
```js
fetch(process.env.SUPABASE_URL + "/rest/v1/rpc/exec_sql", {
  method: "POST",
  headers: {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": "Bearer " + SERVICE_ROLE_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ query: SQL_STRING })
})
```

| Task ID | Görev Adı | Detay |
|---------|-----------|-------|
| P2-101 | energy_readings Tablosu | `energy_readings(id uuid PK, timestamp timestamptz UNIQUE, consumption_mwh float8, production_mwh float8, region text, source text, weather_temp float8, day_of_week int, is_holiday boolean)` |
| P2-102 | forecasts Tablosu | `forecasts(id uuid PK, created_at timestamptz, model_name text, forecast_horizon int, predictions jsonb, mape float8, rmse float8, mae float8, input_window int, metadata jsonb)` |
| P2-103 | model_comparisons Tablosu | `model_comparisons(id uuid PK, run_at timestamptz, prophet_mape float8, xgboost_mape float8, sarima_mape float8, winner text, dataset_period text, notes text)` |
| P2-104 | RLS & Index | `energy_readings`: anon SELECT, authenticated INSERT. `CREATE INDEX ON energy_readings(timestamp DESC);` |

---

### FAZ 2 — Python ML Pipeline

| Task ID | Görev Adı | Detay |
|---------|-----------|-------|
| P2-201 | Veri Toplama Scripti | `python/data_collector.py` — EPİAŞ API'den son 2 yıl saatlik veri. Hava durumu: Open-Meteo API (ücretsiz, kayıt gerekmez). Tatil günleri: `holidays` paketi (TR takvimi). Supabase'e kaydet. |
| P2-202 | Özellik Mühendisliği | `python/feature_engineering.py` — lag features (t-1, t-24, t-168), rolling mean/std (24h, 168h), saat, gün, ay, mevsim, tatil flag, hava durumu. pandas + numpy. |
| P2-203 | Prophet Modeli | `python/models/prophet_model.py` — Meta'nın Prophet'i. Günlük + yıllık mevsimsellik. Tatil günleri özel dönem. Güven aralıkları (yhat_lower/upper) dashboard'da gösterilecek. |
| P2-204 | XGBoost Modeli | `python/models/xgboost_model.py` — `XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=6)`. SHAP değerleri ile açıklanabilirlik. |
| P2-205 | SARIMA Modeli | `python/models/sarima_model.py` — statsmodels `SARIMAX(p=1,d=1,q=1)(P=1,D=1,Q=1,s=24)`. `auto_arima` ile parametreler (pmdarima). Son 2000 nokta kullan (hız için). |
| P2-206 | Model Değerlendirme | `python/evaluate.py` — 3 model için: MAPE, RMSE, MAE, R2. `model_comparisons` tablosuna kaydet. matplotlib ile gerçek vs tahmin grafiği PNG. |
| P2-207 | FastAPI Endpoints | POST /forecast, GET /latest-forecast, GET /model-comparison, GET /feature-importance, POST /update-data |

---

### FAZ 3 — Dashboard UI

| Task ID | Görev Adı | Detay |
|---------|-----------|-------|
| P2-301 | Ana Dashboard | `app/(dashboard)/page.tsx` — Üst: zaman aralığı seçici (7g/30g/90g/1y), model seçici. KPI kartlar: Ortalama Tüketim, Peak Saat, Tahmin Doğruluğu, En İyi Model. |
| P2-302 | Tahmin Grafiği (Ana) | `components/ForecastChart.tsx` — Chart.js Line. 3 çizgi: Gerçek (mavi düz), Tahmin (mavi kesikli), Güven Aralığı (açık mavi fill). Zoom: chartjs-plugin-zoom. |
| P2-303 | Model Karşılaştırma Grafiği | `components/ModelComparison.tsx` — Chart.js Bar: 3 model × 4 metrik (MAPE, RMSE, MAE, R2). En düşük hata = yeşil vurgulu. |
| P2-304 | Saatlik Isı Haritası | `components/HeatmapChart.tsx` — 7 gün × 24 saat ısı haritası. Renk skalası: düşük (beyaz) → yüksek (koyu mavi). Peak saatleri otomatik işaretle. |
| P2-305 | Özellik Önem Grafiği | `components/FeatureImportance.tsx` — XGBoost SHAP değerleri. Yatay bar chart. "Sıcaklık", "Saat", "Tatil" gibi anlaşılır etiketler. |
| P2-306 | Senaryo Analizi | `components/ScenarioAnalysis.tsx` — Kullanıcı sıcaklık/tatil/saat değiştirir → model yeniden tahmin → grafik güncellenir. shadcn/ui Slider + Switch. |
| P2-307 | Tahmin Tablosu | `components/ForecastTable.tsx` — shadcn/ui DataTable. Kolonlar: Saat, Gerçek, Prophet, XGBoost, SARIMA, Hata (%). Renk kodu: <5% yeşil, 5-10% sarı, >10% kırmızı. CSV export. |
| P2-308 | "Power BI" Export | `components/ExportPanel.tsx` — PDF rapor (html2canvas+jspdf), Excel (xlsx), CSV. Raporda: tüm grafikler + model metrikleri + yönetici özeti. Power BI maddesini karşılar. |

---

### FAZ 4 — Deployment

| Task ID | Görev Adı | Detay |
|---------|-----------|-------|
| P2-401 | Python API → Render | render.com → New Web Service → GitHub repo → Root: `python/` → Build: `pip install -r requirements.txt` → Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Ücretsiz tier. |
| P2-402 | Cron Job | `vercel.json`: `{"crons":[{"path":"/api/cron/update-data","schedule":"0 * * * *"}]}` — Her saat başı EPİAŞ'tan yeni veri. |
| P2-403 | Next.js → Vercel | Environment variables: tüm `.env.local` içeriği + `NEXT_PUBLIC_ML_API_URL=Render URL`. |
| P2-404 | README Metrikleri | Tablo: Prophet MAPE, XGBoost MAPE, SARIMA MAPE (gerçek sayısal değerler). Ekran görüntüleri + demo link. |
