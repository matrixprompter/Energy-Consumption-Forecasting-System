"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { KPICards } from "@/components/KPICards";
import { HeatmapChart } from "@/components/HeatmapChart";
import { ScenarioAnalysis } from "@/components/ScenarioAnalysis";
import { ForecastTable } from "@/components/ForecastTable";
import { ExportPanel } from "@/components/ExportPanel";
import { OnboardingTour } from "@/components/OnboardingTour";

const ForecastChart = dynamic(() => import("@/components/ForecastChart").then((m) => m.ForecastChart), { ssr: false });
const ModelComparison = dynamic(() => import("@/components/ModelComparison").then((m) => m.ModelComparison), { ssr: false });
const FeatureImportance = dynamic(() => import("@/components/FeatureImportance").then((m) => m.FeatureImportance), { ssr: false });

const ML_API = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

const PERIOD_OPTIONS = [
  { value: "live24h", label: "Son 24 Saat" },
  { value: "1d", label: "1 Gün" },
  { value: "7d", label: "7 Gün" },
  { value: "30d", label: "1 Ay" },
  { value: "90d", label: "3 Ay" },
  { value: "180d", label: "6 Ay" },
  { value: "1y", label: "1 Yıl" },
];

const MODEL_OPTIONS = [
  { value: "xgboost", label: "XGBoost" },
  { value: "prophet", label: "Prophet" },
];

// ---------------------------------------------------------------------------
// Demo veri üreteçleri (API yokken fallback)
// ---------------------------------------------------------------------------
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateDemoTimeline(days: number) {
  const rand = seededRandom(42 + days);
  const now = new Date();
  const labels: string[] = [];
  const actual: number[] = [];
  const predicted: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];

  for (let h = 0; h < days * 24; h++) {
    const d = new Date(now.getTime() - (days * 24 - h) * 3600000);
    labels.push(d.toISOString());
    const hourOfDay = h % 24;
    const hourFactor = -Math.cos((hourOfDay / 24) * Math.PI * 2) * 5000;
    const weekFactor = Math.sin((h / 168) * Math.PI * 2) * 1500;
    const base = 30000 + hourFactor + weekFactor;
    const noise = (rand() - 0.5) * 2000;
    const val = base + noise;
    actual.push(Math.round(val));
    const pred = val + (rand() - 0.5) * 1500;
    predicted.push(Math.round(pred));
    lower.push(Math.round(pred - 2000));
    upper.push(Math.round(pred + 2000));
  }
  return { labels, actual, predicted, lower, upper };
}

function generateDemoHeatmap(): number[][] {
  const rand = seededRandom(123);
  return Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const hourFactor = -Math.cos((h / 24) * Math.PI * 2) * 6000;
      const base = 28000 + hourFactor;
      const dayFactor = d >= 5 ? -3000 : 0;
      return Math.round(base + dayFactor + (rand() - 0.5) * 1500);
    })
  );
}

function generateDemoTableRows(count: number) {
  const rand = seededRandom(456);
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getTime() - (count - i) * 3600000);
    const hourFactor = -Math.cos((i / 24) * Math.PI * 2) * 5000;
    const base = 30000 + hourFactor;
    return {
      hour: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`,
      actual: Math.round(base + (rand() - 0.5) * 1000),
      prophet: Math.round(base + (rand() - 0.5) * 2000),
      xgboost: Math.round(base + (rand() - 0.5) * 1200),
    };
  });
}

const DEMO_PERIOD_DATA: Record<string, { prophet: { mape: number; rmse: number; mae: number; r2: number }; xgboost: { mape: number; rmse: number; mae: number; r2: number }; winner: string }> = {
  "1d": { prophet: { mape: 3.5, rmse: 1100, mae: 850, r2: 0.93 }, xgboost: { mape: 2.8, rmse: 900, mae: 700, r2: 0.96 }, winner: "xgboost" },
  "7d": { prophet: { mape: 4.2, rmse: 1250, mae: 980, r2: 0.92 }, xgboost: { mape: 3.8, rmse: 1100, mae: 870, r2: 0.95 }, winner: "xgboost" },
  "30d": { prophet: { mape: 5.1, rmse: 1400, mae: 1100, r2: 0.90 }, xgboost: { mape: 3.9, rmse: 1150, mae: 900, r2: 0.94 }, winner: "xgboost" },
  "90d": { prophet: { mape: 6.8, rmse: 1800, mae: 1400, r2: 0.85 }, xgboost: { mape: 4.2, rmse: 1200, mae: 950, r2: 0.93 }, winner: "xgboost" },
};

const DEMO_FEATURES = [
  { name: "1 Saat Önceki Tüketim", feature: "lag_1h", shap_value: 2850 },
  { name: "24 Saat Önceki Tüketim", feature: "lag_24h", shap_value: 2100 },
  { name: "Sıcaklık (°C)", feature: "weather_temp", shap_value: 1800 },
  { name: "Saat", feature: "hour", shap_value: 1650 },
  { name: "24s Ortalama", feature: "rolling_mean_24h", shap_value: 1400 },
  { name: "1 Hafta Önceki Tüketim", feature: "lag_168h", shap_value: 1200 },
  { name: "Haftanın Günü", feature: "day_of_week", shap_value: 950 },
  { name: "Hafta Sonu", feature: "is_weekend", shap_value: 820 },
  { name: "Tatil Günü", feature: "is_holiday_int", shap_value: 680 },
  { name: "Ay", feature: "month", shap_value: 550 },
  { name: "Mevsim", feature: "season", shap_value: 420 },
  { name: "24s Std Sapma", feature: "rolling_std_24h", shap_value: 380 },
  { name: "Haftalık Ortalama", feature: "rolling_mean_168h", shap_value: 310 },
  { name: "Haftalık Std Sapma", feature: "rolling_std_168h", shap_value: 250 },
];

// ---------------------------------------------------------------------------
// Gerçek veri dönüştürücüleri
// ---------------------------------------------------------------------------

interface EnergyReading {
  timestamp: string;
  consumption_mwh: number;
  day_of_week: number;
}

function sortReadings(readings: EnergyReading[]) {
  return [...readings].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function buildTimelineFromReadings(
  sorted: EnergyReading[],
  forecastPreds: Array<{ value: number; lower: number; upper: number }>,
) {
  const labels = sorted.map((r) => r.timestamp);
  const actual = sorted.map((r) => r.consumption_mwh);

  const predicted: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];

  const forecastLen = forecastPreds.length;
  const padLen = Math.max(0, sorted.length - forecastLen);

  for (let i = 0; i < padLen; i++) {
    predicted.push(actual[i]);
    lower.push(actual[i]);
    upper.push(actual[i]);
  }
  for (const p of forecastPreds) {
    predicted.push(p.value);
    lower.push(p.lower);
    upper.push(p.upper);
  }

  return { labels, actual, predicted, lower, upper };
}

function buildHeatmapFromReadings(readings: EnergyReading[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const counts: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const r of readings) {
    const d = new Date(r.timestamp);
    const dow = r.day_of_week;
    const hour = d.getHours();
    if (dow >= 0 && dow < 7 && hour >= 0 && hour < 24) {
      grid[dow][hour] += r.consumption_mwh;
      counts[dow][hour] += 1;
    }
  }

  return grid.map((row, d) =>
    row.map((val, h) => (counts[d][h] > 0 ? Math.round(val / counts[d][h]) : 0))
  );
}

function buildTableRows(
  sorted: EnergyReading[],
  allPreds: { prophet: number[]; xgboost: number[] },
) {
  // Son 24 saati tahminlerle eşleştir, geri kalanı sadece gerçek veri olarak döndür
  const last24Start = Math.max(0, sorted.length - 24);

  return sorted.map((r, i) => {
    const d = new Date(r.timestamp);
    const predIdx = i - last24Start;
    const hasPred = predIdx >= 0 && predIdx < 24;
    return {
      hour: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`,
      actual: Math.round(r.consumption_mwh),
      prophet: hasPred ? Math.round(allPreds.prophet[predIdx] ?? r.consumption_mwh) : Math.round(r.consumption_mwh),
      xgboost: hasPred ? Math.round(allPreds.xgboost[predIdx] ?? r.consumption_mwh) : Math.round(r.consumption_mwh),
    };
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
interface TimelineData {
  labels: string[];
  actual: number[];
  predicted: number[];
  lower: number[];
  upper: number[];
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("live24h");
  const [model, setModel] = useState("xgboost");
  const [apiAvailable, setApiAvailable] = useState(false);
  const [periodData, setPeriodData] = useState(DEMO_PERIOD_DATA);
  const [features, setFeatures] = useState(DEMO_FEATURES);
  const [initialLoading, setInitialLoading] = useState(true);

  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [heatmap, setHeatmap] = useState<number[][] | null>(null);
  const [tableRows, setTableRows] = useState<Array<{
    hour: string; actual: number; prophet: number; xgboost: number;
  }> | null>(null);
  const [tablePeriod, setTablePeriod] = useState("live24h");

  // Cache — enerji verisi period bazlı, tahminler ayrı
  const readingsRef = useRef<{ periodKey: string; sorted: EnergyReading[] }>({ periodKey: "", sorted: [] });
  const tablePredsRef = useRef<{ prophet: number[]; xgboost: number[] }>({
    prophet: [], xgboost: [],
  });
  const tableReadingsRef = useRef<{ periodKey: string; sorted: EnergyReading[] }>({ periodKey: "", sorted: [] });
  // readingsVersion: useEffect #2 veriyi yükleyince artırılır, useEffect #3'ü tetikler
  const [readingsVersion, setReadingsVersion] = useState(0);

  const periodDays = period === "live24h" ? 1 : period === "1d" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
  const tablePeriodDays = tablePeriod === "live24h" ? 1 : tablePeriod === "1d" ? 1 : tablePeriod === "7d" ? 7 : tablePeriod === "30d" ? 30 : tablePeriod === "90d" ? 90 : tablePeriod === "180d" ? 180 : 365;

  // ── 1) Başlangıç: ML API kontrol + karşılaştırma + SHAP ──
  useEffect(() => {
    async function checkML() {
      try {
        const res = await fetch(`${ML_API}/health`, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) { setApiAvailable(false); return; }
        setApiAvailable(true);

        const [compRes, shapRes] = await Promise.all([
          fetch(`${ML_API}/model-comparison/all`),
          fetch(`${ML_API}/feature-importance`),
        ]);

        if (compRes.ok) {
          const data = await compRes.json();
          if (Object.keys(data).length > 0) {
            setPeriodData(data);
          }
        }

        if (shapRes.ok) {
          const shapData = await shapRes.json();
          if (shapData.features?.length > 0) setFeatures(shapData.features);
        }
      } catch {
        setApiAvailable(false);
      }
    }
    checkML();
  }, []);

  // ── 2) Period değiştiğinde → enerji verisi + heatmap + tablo tahminleri ──
  useEffect(() => {
    let cancelled = false;
    const periodKey = `${periodDays}`;

    async function loadPeriodData() {
      // Cache kontrolü
      if (readingsRef.current.periodKey === periodKey && readingsRef.current.sorted.length > 0) {
        return readingsRef.current.sorted;
      }

      try {
        const now = new Date();
        const from = new Date(now.getTime() - periodDays * 24 * 3600000);
        const res = await fetch(
          `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${periodDays * 24}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        const readings: EnergyReading[] = data.data || [];
        const sorted = sortReadings(readings);

        if (!cancelled) {
          readingsRef.current = { periodKey, sorted };
          setReadingsVersion((v) => v + 1);
        }
        return sorted;
      } catch {
        return [];
      }
    }

    async function load() {
      const sorted = await loadPeriodData();
      if (cancelled) return;

      if (sorted.length === 0) {
        // Demo fallback
        const cappedDays = periodDays > 30 ? 30 : periodDays;
        setTimeline(generateDemoTimeline(cappedDays));
        setHeatmap(generateDemoHeatmap());
        setInitialLoading(false);
        return;
      }

      // Heatmap (model bağımsız)
      setHeatmap(buildHeatmapFromReadings(sorted));

      // Model tahminlerini çek (tablo + KPI için sadece 24h preds ref'e kaydet)
      try {
        const [pRes, xRes] = await Promise.all([
          fetch(`${ML_API}/forecast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "prophet", horizon: 24, region: "TR" }),
          }),
          fetch(`${ML_API}/forecast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "xgboost", horizon: 24, region: "TR" }),
          }),
        ]);

        const preds = { prophet: [] as number[], xgboost: [] as number[] };
        if (pRes.ok) preds.prophet = (await pRes.json()).predictions.map((p: { value: number }) => p.value);
        if (xRes.ok) preds.xgboost = (await xRes.json()).predictions.map((p: { value: number }) => p.value);

        if (!cancelled) {
          tablePredsRef.current = preds;
        }
      } catch {
        // tahminler alınamazsa boş kalır
      }

      setInitialLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [periodDays]);

  // ── 3) Model değiştiğinde → sadece tahmin grafiği güncellenir ──
  useEffect(() => {
    const sorted = readingsRef.current.sorted;
    if (sorted.length === 0) return;

    let cancelled = false;

    async function updateForecast() {
      let forecastPreds: Array<{ value: number; lower: number; upper: number }> = [];
      try {
        const horizon = Math.min(sorted.length, 168);
        const fRes = await fetch(`${ML_API}/forecast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, horizon, region: "TR" }),
        });
        if (fRes.ok) {
          forecastPreds = (await fRes.json()).predictions || [];
        }
      } catch { /* grafik gerçek veriyi gösterir */ }

      if (!cancelled) {
        setTimeline(buildTimelineFromReadings(sorted, forecastPreds));
      }
    }

    updateForecast();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, periodDays, readingsVersion]);

  // ── 4) Tablo periyodu değiştiğinde → tablo verisi bağımsız yüklenir ──
  useEffect(() => {
    let cancelled = false;

    async function loadTableData() {
      const tpKey = `${tablePeriodDays}`;

      // Eğer ana periyot cache'i aynı veya daha büyükse onu kullan
      const mainSorted = readingsRef.current.sorted;
      if (mainSorted.length > 0 && mainSorted.length >= tablePeriodDays * 24) {
        const sliced = mainSorted.slice(-tablePeriodDays * 24);
        if (!cancelled) setTableRows(buildTableRows(sliced, tablePredsRef.current));
        return;
      }

      // Tablo cache kontrolü
      if (tableReadingsRef.current.periodKey === tpKey && tableReadingsRef.current.sorted.length > 0) {
        if (!cancelled) setTableRows(buildTableRows(tableReadingsRef.current.sorted, tablePredsRef.current));
        return;
      }

      // Supabase'den veri çek
      try {
        const now = new Date();
        const from = new Date(now.getTime() - tablePeriodDays * 24 * 3600000);
        const res = await fetch(
          `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${tablePeriodDays * 24}`
        );
        if (!res.ok) {
          if (!cancelled) setTableRows(generateDemoTableRows(tablePeriodDays * 24 > 720 ? 720 : tablePeriodDays * 24));
          return;
        }
        const data = await res.json();
        const readings: EnergyReading[] = data.data || [];
        const sorted = sortReadings(readings);

        if (sorted.length === 0) {
          if (!cancelled) setTableRows(generateDemoTableRows(tablePeriodDays * 24 > 720 ? 720 : tablePeriodDays * 24));
          return;
        }

        if (!cancelled) {
          tableReadingsRef.current = { periodKey: tpKey, sorted };
          setTableRows(buildTableRows(sorted, tablePredsRef.current));
        }
      } catch {
        if (!cancelled) setTableRows(generateDemoTableRows(tablePeriodDays * 24 > 720 ? 720 : tablePeriodDays * 24));
      }
    }

    loadTableData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePeriod, tablePeriodDays, readingsVersion]);

  // İlk yükleme
  if (initialLoading && !timeline) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  // Son 24 saat tablosundan model metriklerini hesapla
  const tableMetrics = tableRows
    ? (() => {
        const last24Rows = tableRows.slice(-24);
        function computeModelMetrics(
          rows: Array<{ actual: number; prophet: number; xgboost: number }>,
          modelKey: "prophet" | "xgboost",
        ) {
          const n = rows.length;
          if (n === 0) return { mape: 0, rmse: 0, mae: 0, r2: 0 };
          let sumAbsPctErr = 0;
          let sumSqErr = 0;
          let sumAbsErr = 0;
          let sumActual = 0;
          let sumSqTot = 0;

          for (const r of rows) {
            sumActual += r.actual;
          }
          const meanActual = sumActual / n;

          for (const r of rows) {
            const pred = r[modelKey];
            const err = r.actual - pred;
            sumAbsPctErr += Math.abs(err / r.actual);
            sumSqErr += err * err;
            sumAbsErr += Math.abs(err);
            sumSqTot += (r.actual - meanActual) ** 2;
          }

          return {
            mape: Math.round((sumAbsPctErr / n) * 10000) / 100,
            rmse: Math.round(Math.sqrt(sumSqErr / n) * 100) / 100,
            mae: Math.round((sumAbsErr / n) * 100) / 100,
            r2: sumSqTot !== 0 ? Math.round((1 - sumSqErr / sumSqTot) * 10000) / 10000 : 0,
          };
        }

        const p = computeModelMetrics(last24Rows, "prophet");
        const x = computeModelMetrics(last24Rows, "xgboost");
        const minMape = Math.min(p.mape, x.mape);
        const w = p.mape === minMape ? "prophet" : "xgboost";
        return { prophet: p, xgboost: x, winner: w };
      })()
    : null;

  // Henüz veriler gelmediyse demo ile doldur
  const tl = timeline ?? generateDemoTimeline(7);
  const hm = heatmap ?? generateDemoHeatmap();
  const tr = tableRows ?? generateDemoTableRows(24);

  // KPI: tablo verisi varsa son 24 saatten hesapla, yoksa timeline'dan
  const kpiSource = tr.slice(-24);
  const avgConsumption = kpiSource.reduce((a, b) => a + b.actual, 0) / kpiSource.length;
  const peakRow = kpiSource.reduce((best, row) => (row.actual > best.actual ? row : best), kpiSource[0]);
  const peakHour = parseInt(peakRow?.hour ?? "0", 10);

  // Aktif periyoda göre KPI metrikleri belirle
  const isLive = period === "live24h";
  const activePeriod = isLive ? null : (periodData[period] || periodData["7d"] || Object.values(periodData)[0]);
  const kpiWinner = isLive
    ? (tableMetrics ? tableMetrics.winner : "xgboost")
    : (activePeriod?.winner || "xgboost");
  const kpiBestMape = isLive
    ? (tableMetrics ? Math.min(tableMetrics.prophet.mape, tableMetrics.xgboost.mape) : 0)
    : activePeriod
      ? Math.min(activePeriod.prophet.mape, activePeriod.xgboost.mape)
      : 0;

  return (
    <div id="dashboard-content" className="space-y-4 overflow-hidden sm:space-y-6">
      <OnboardingTour />

      {/* Kontroller */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <Select options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value)} />
        <Select options={MODEL_OPTIONS} value={model} onChange={(e) => setModel(e.target.value)} />
        {!apiAvailable && (
          <span className="self-start rounded-md bg-yellow-100 px-3 py-1 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            Demo modu — ML API bağlı değil
          </span>
        )}
        {apiAvailable && (
          <span className="self-start rounded-md bg-green-100 px-3 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
            Canlı veri — EPİAŞ + ML API bağlı
          </span>
        )}
      </div>

      {/* KPI Kartları */}
      <KPICards
        avgConsumption={avgConsumption}
        peakHour={peakHour}
        bestAccuracy={kpiBestMape}
        bestModel={kpiWinner}
      />

      {/* Ana Tahmin Grafiği */}
      <ForecastChart
        labels={tl.labels}
        actual={tl.actual}
        predicted={tl.predicted}
        lower={tl.lower}
        upper={tl.upper}
        modelName={model}
      />

      {/* Model Karşılaştırma + Özellik Önemi */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ModelComparison
          periodData={periodData}
          tableMetrics={tableMetrics}
        />
        <FeatureImportance features={features} />
      </div>

      {/* Isı Haritası */}
      <HeatmapChart data={hm} />

      {/* Senaryo + Export */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ScenarioAnalysis />
        <ExportPanel
          forecastData={tr}
          modelMetrics={(() => {
            const pd = (period === "live24h" ? tableMetrics : periodData[period]) || periodData["7d"];
            if (!pd) return {} as Record<string, Record<string, number>>;
            return { prophet: pd.prophet, xgboost: pd.xgboost } as Record<string, Record<string, number>>;
          })()}
        />
      </div>

      {/* Tahmin Tablosu */}
      <ForecastTable rows={tr} period={tablePeriod} onPeriodChange={setTablePeriod} />
    </div>
  );
}
