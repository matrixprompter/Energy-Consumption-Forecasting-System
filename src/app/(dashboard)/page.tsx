"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICards } from "@/components/KPICards";
import { HeatmapChart } from "@/components/HeatmapChart";
import { ScenarioAnalysis } from "@/components/ScenarioAnalysis";
import { ForecastTable } from "@/components/ForecastTable";
import { ExportPanel } from "@/components/ExportPanel";
import { OnboardingTour } from "@/components/OnboardingTour";

const ForecastChart = dynamic(() => import("@/components/ForecastChart").then((m) => m.ForecastChart), { ssr: false });
const ModelComparison = dynamic(() => import("@/components/ModelComparison").then((m) => m.ModelComparison), { ssr: false });
const FeatureImportance = dynamic(() => import("@/components/FeatureImportance").then((m) => m.FeatureImportance), { ssr: false });

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
// Veri dönüştürücüleri
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
  const last24Start = Math.max(0, sorted.length - 24);

  return sorted.map((r, i) => {
    const d = new Date(r.timestamp);
    const predIdx = i - last24Start;
    const hasPred = predIdx >= 0 && predIdx < 24;
    return {
      hour: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`,
      actual: Math.round(r.consumption_mwh),
      prophet: hasPred && allPreds.prophet.length > 0 ? Math.round(allPreds.prophet[predIdx] ?? 0) : 0,
      xgboost: hasPred && allPreds.xgboost.length > 0 ? Math.round(allPreds.xgboost[predIdx] ?? 0) : 0,
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

type PeriodComparison = {
  prophet: { mape: number; rmse: number; mae: number; r2: number };
  xgboost: { mape: number; rmse: number; mae: number; r2: number };
  winner: string;
};

export default function DashboardPage() {
  const [period, setPeriod] = useState("live24h");
  const [model, setModel] = useState("xgboost");
  const [periodData, setPeriodData] = useState<Record<string, PeriodComparison>>({});
  const [features, setFeatures] = useState<Array<{ name: string; feature: string; shap_value: number }>>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [heatmap, setHeatmap] = useState<number[][] | null>(null);
  const [tableRows, setTableRows] = useState<Array<{
    hour: string; actual: number; prophet: number; xgboost: number;
  }> | null>(null);
  const [tablePeriod, setTablePeriod] = useState("live24h");

  // Cache
  const readingsRef = useRef<{ periodKey: string; sorted: EnergyReading[] }>({ periodKey: "", sorted: [] });
  const tablePredsRef = useRef<{ prophet: number[]; xgboost: number[] }>({
    prophet: [], xgboost: [],
  });
  const tableReadingsRef = useRef<{ periodKey: string; sorted: EnergyReading[] }>({ periodKey: "", sorted: [] });
  const [readingsVersion, setReadingsVersion] = useState(0);

  const periodDays = period === "live24h" ? 1 : period === "1d" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : period === "180d" ? 180 : 365;
  const tablePeriodDays = tablePeriod === "live24h" ? 1 : tablePeriod === "1d" ? 1 : tablePeriod === "7d" ? 7 : tablePeriod === "30d" ? 30 : tablePeriod === "90d" ? 90 : tablePeriod === "180d" ? 180 : 365;

  // ── 1) Başlangıç: Supabase'den HER ŞEYİ yükle ──
  useEffect(() => {
    async function init() {
      // 1. Enerji verisi
      try {
        const now = new Date();
        const from = new Date(now.getTime() - 7 * 24 * 3600000);
        const res = await fetch(
          `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${7 * 24}`
        );
        if (res.ok) {
          const data = await res.json();
          const readings: EnergyReading[] = data.data || [];
          const sorted = sortReadings(readings);

          if (sorted.length > 0) {
            readingsRef.current = { periodKey: "7", sorted };
            setHeatmap(buildHeatmapFromReadings(sorted));
            setDataLoaded(true);
            setReadingsVersion((v) => v + 1);
          }
        }
      } catch { /* Supabase erişim hatası */ }

      // 2. Model karşılaştırma (Supabase model_comparisons tablosu)
      try {
        const compRes = await fetch("/api/forecast/compare");
        if (compRes.ok) {
          const data = await compRes.json();
          if (Object.keys(data).length > 0) setPeriodData(data);
        }
      } catch { /* opsiyonel */ }

      // 3. SHAP verilerini Supabase'den çek
      try {
        const shapRes = await fetch("/api/forecast/shap");
        if (shapRes.ok) {
          const shapData = await shapRes.json();
          if (shapData.features && shapData.features.length > 0) {
            setFeatures(shapData.features);
          }
        }
      } catch { /* opsiyonel */ }

      // Forecasts tablosundan tahmin verilerini çek
      try {
        const fcRes = await fetch("/api/forecast/latest");
        if (fcRes.ok) {
          const fcData = await fcRes.json();
          const preds = { prophet: [] as number[], xgboost: [] as number[] };

          if (fcData.prophet?.predictions) {
            preds.prophet = fcData.prophet.predictions.map((p: { value: number }) => p.value);
          }
          if (fcData.xgboost?.predictions) {
            preds.xgboost = fcData.xgboost.predictions.map((p: { value: number }) => p.value);
          }

          if (preds.prophet.length > 0 || preds.xgboost.length > 0) {
            tablePredsRef.current = preds;
          }
        }
      } catch { /* opsiyonel */ }

      // Timeline ve tablo oluştur
      const sorted = readingsRef.current.sorted;
      const preds = tablePredsRef.current;
      if (sorted.length > 0) {
        const selectedPreds = preds.xgboost.length > 0 ? preds.xgboost : preds.prophet;
        const forecastPreds = selectedPreds.map((v) => ({
          value: v,
          lower: v * 0.95,
          upper: v * 1.05,
        }));
        setTimeline(buildTimelineFromReadings(sorted, forecastPreds));
        setTableRows(buildTableRows(sorted.slice(-24), preds));
      }
    }
    init();
  }, []);

  // ── 2) Period değiştiğinde → Supabase'den enerji verisi + heatmap ──
  useEffect(() => {
    if (!dataLoaded) return;
    let cancelled = false;
    const periodKey = `${periodDays}`;

    async function load() {
      if (readingsRef.current.periodKey === periodKey && readingsRef.current.sorted.length > 0) {
        setHeatmap(buildHeatmapFromReadings(readingsRef.current.sorted));
        return;
      }

      try {
        const now = new Date();
        const from = new Date(now.getTime() - periodDays * 24 * 3600000);
        const res = await fetch(
          `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${periodDays * 24}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const readings: EnergyReading[] = data.data || [];
        const sorted = sortReadings(readings);

        if (!cancelled && sorted.length > 0) {
          readingsRef.current = { periodKey, sorted };
          setHeatmap(buildHeatmapFromReadings(sorted));
          setReadingsVersion((v) => v + 1);
        }
      } catch { /* veri yüklenemezse boş kalır */ }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays, dataLoaded]);

  // ── 3) Model veya period değiştiğinde → timeline güncelle ──
  useEffect(() => {
    const sorted = readingsRef.current.sorted;
    if (sorted.length === 0) return;

    const preds = tablePredsRef.current;
    if (preds.prophet.length === 0 && preds.xgboost.length === 0) {
      setTimeline(buildTimelineFromReadings(sorted, []));
      return;
    }

    const selectedPreds = model === "prophet" ? preds.prophet : preds.xgboost;
    const forecastPreds = selectedPreds.map((v) => ({
      value: v,
      lower: v * 0.95,
      upper: v * 1.05,
    }));
    setTimeline(buildTimelineFromReadings(sorted, forecastPreds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, periodDays, readingsVersion]);

  // ── 4) Tablo periyodu değiştiğinde → tablo verisi yükle ──
  useEffect(() => {
    if (!dataLoaded) return;
    let cancelled = false;

    async function loadTableData() {
      const tpKey = `${tablePeriodDays}`;

      const mainSorted = readingsRef.current.sorted;
      if (mainSorted.length > 0 && mainSorted.length >= tablePeriodDays * 24) {
        const sliced = mainSorted.slice(-tablePeriodDays * 24);
        if (!cancelled) setTableRows(buildTableRows(sliced, tablePredsRef.current));
        return;
      }

      if (tableReadingsRef.current.periodKey === tpKey && tableReadingsRef.current.sorted.length > 0) {
        if (!cancelled) setTableRows(buildTableRows(tableReadingsRef.current.sorted, tablePredsRef.current));
        return;
      }

      try {
        const now = new Date();
        const from = new Date(now.getTime() - tablePeriodDays * 24 * 3600000);
        const res = await fetch(
          `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${tablePeriodDays * 24}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const readings: EnergyReading[] = data.data || [];
        const sorted = sortReadings(readings);

        if (!cancelled && sorted.length > 0) {
          tableReadingsRef.current = { periodKey: tpKey, sorted };
          setTableRows(buildTableRows(sorted, tablePredsRef.current));
        }
      } catch { /* veri yüklenemezse boş kalır */ }
    }

    loadTableData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePeriod, tablePeriodDays, readingsVersion, dataLoaded]);

  // ── Metrikler hesapla ──
  const tableMetrics = tableRows && tableRows.length > 0 && tableRows.some((r) => r.prophet > 0 || r.xgboost > 0)
    ? (() => {
        const predRows = tableRows.filter((r) => r.prophet > 0 || r.xgboost > 0);
        function computeModelMetrics(
          rows: Array<{ actual: number; prophet: number; xgboost: number }>,
          modelKey: "prophet" | "xgboost",
        ) {
          const validRows = rows.filter((r) => r[modelKey] > 0);
          const n = validRows.length;
          if (n === 0) return { mape: 0, rmse: 0, mae: 0, r2: 0 };
          let sumAbsPctErr = 0;
          let sumSqErr = 0;
          let sumAbsErr = 0;
          let sumActual = 0;
          let sumSqTot = 0;

          for (const r of validRows) sumActual += r.actual;
          const meanActual = sumActual / n;

          for (const r of validRows) {
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

        const p = computeModelMetrics(predRows, "prophet");
        const x = computeModelMetrics(predRows, "xgboost");
        const minMape = Math.min(p.mape, x.mape);
        const w = p.mape === minMape ? "prophet" : "xgboost";
        return { prophet: p, xgboost: x, winner: w };
      })()
    : null;

  const tl = timeline;
  const hm = heatmap;
  const tr = tableRows || [];

  // KPI — ana period filtresine bağlı
  const kpiReadings = readingsRef.current.sorted;
  const avgConsumption = kpiReadings.length > 0
    ? kpiReadings.reduce((a, b) => a + b.consumption_mwh, 0) / kpiReadings.length
    : 0;
  const peakReading = kpiReadings.length > 0
    ? kpiReadings.reduce((best, r) => (r.consumption_mwh > best.consumption_mwh ? r : best), kpiReadings[0])
    : null;
  const peakHour = peakReading ? new Date(peakReading.timestamp).getHours() : 0;

  const isLive = period === "live24h";
  const activePeriod = isLive ? null : (periodData[period] || periodData["7d"] || Object.values(periodData)[0]);
  const kpiWinner = isLive
    ? (tableMetrics ? tableMetrics.winner : "—")
    : (activePeriod?.winner || "—");
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
      </div>

      {/* KPI Kartları */}
      <KPICards
        avgConsumption={avgConsumption}
        peakHour={peakHour}
        bestAccuracy={kpiBestMape}
        bestModel={kpiWinner}
      />

      {/* Ana Tahmin Grafiği */}
      {tl ? (
        <ForecastChart
          labels={tl.labels}
          actual={tl.actual}
          predicted={tl.predicted}
          lower={tl.lower}
          upper={tl.upper}
          modelName={model}
        />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">Enerji Tüketim Tahmini</CardTitle></CardHeader>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Veriler yükleniyor...
          </CardContent>
        </Card>
      )}

      {/* Model Karşılaştırma + Özellik Önemi */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {Object.keys(periodData).length > 0 ? (
          <ModelComparison
            periodData={periodData}
            tableMetrics={tableMetrics}
          />
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg">Model Karşılaştırma</CardTitle></CardHeader>
            <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
              Veriler yükleniyor...
            </CardContent>
          </Card>
        )}

        <FeatureImportance features={features} />
      </div>

      {/* Isı Haritası */}
      {hm ? (
        <HeatmapChart data={hm} />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">Saatlik Tüketim Isı Haritası</CardTitle></CardHeader>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Veriler yükleniyor...
          </CardContent>
        </Card>
      )}

      {/* Senaryo + Export */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ScenarioAnalysis />
        <ExportPanel
          forecastData={tr}
          modelMetrics={(() => {
            const pd = (isLive ? tableMetrics : periodData[period]) || periodData["7d"];
            if (!pd) return {} as Record<string, Record<string, number>>;
            return { prophet: pd.prophet, xgboost: pd.xgboost } as Record<string, Record<string, number>>;
          })()}
        />
      </div>

      {/* Tahmin Tablosu */}
      {tr.length > 0 ? (
        <ForecastTable rows={tr} period={tablePeriod} onPeriodChange={setTablePeriod} />
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base sm:text-lg">Tahmin Veri Tablosu</CardTitle></CardHeader>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Veriler yükleniyor...
          </CardContent>
        </Card>
      )}
    </div>
  );
}
