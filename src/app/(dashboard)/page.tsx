"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
// ML API tahmin adımları
// ---------------------------------------------------------------------------
const ML_STEPS = [
  "ML API sunucusu başlatılıyor...",
  "Prophet ve XGBoost modelleri yükleniyor...",
  "Tahminler oluşturuluyor...",
  "Model karşılaştırma verileri alınıyor...",
  "SHAP özellik analizi hesaplanıyor...",
];

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
  const [mlLoaded, setMlLoaded] = useState(false);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlStep, setMlStep] = useState<string | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);
  const [periodData, setPeriodData] = useState<Record<string, PeriodComparison>>({});
  const [features, setFeatures] = useState<Array<{ name: string; feature: string; shap_value: number }>>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [dataRefreshing, setDataRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
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

  // ── Tahminleri Al butonu — ML API başlat + tahmin yükle ──
  const handleLoadML = useCallback(async () => {
    if (mlLoading) return;
    setMlLoading(true);
    setMlError(null);

    try {
      // Adım 1: ML API'yi başlat (Render cold start ~10sn)
      setMlStep(ML_STEPS[0]);
      const healthRes = await fetch(`${ML_API}/health`, { signal: AbortSignal.timeout(30000) });
      if (!healthRes.ok) {
        setMlError("ML API sunucusuna ulaşılamıyor");
        setMlLoading(false);
        setMlStep(null);
        return;
      }

      // Adım 2: Tahminleri çek
      setMlStep(ML_STEPS[1]);
      await new Promise((r) => setTimeout(r, 800));

      setMlStep(ML_STEPS[2]);
      const sorted = readingsRef.current.sorted;
      let preds = { prophet: [] as number[], xgboost: [] as number[] };
      let forecastPreds: Array<{ value: number; lower: number; upper: number }> = [];

      try {
        const [pRes, xRes, fRes] = await Promise.all([
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
          fetch(`${ML_API}/forecast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, horizon: Math.min(sorted.length || 24, 168), region: "TR" }),
          }),
        ]);
        if (pRes.ok) preds.prophet = (await pRes.json()).predictions.map((p: { value: number }) => p.value);
        if (xRes.ok) preds.xgboost = (await xRes.json()).predictions.map((p: { value: number }) => p.value);
        if (fRes.ok) forecastPreds = (await fRes.json()).predictions || [];
      } catch { /* tahmin hatası — devam et */ }

      tablePredsRef.current = preds;

      // Timeline ve tablo güncelle
      if (sorted.length > 0) {
        setTimeline(buildTimelineFromReadings(sorted, forecastPreds));
        setTableRows(buildTableRows(sorted.slice(-tablePeriodDays * 24), preds));
      }

      // Adım 3: Model karşılaştırma
      setMlStep(ML_STEPS[3]);
      try {
        const compRes = await fetch(`${ML_API}/model-comparison/all`);
        if (compRes.ok) {
          const data = await compRes.json();
          if (Object.keys(data).length > 0) setPeriodData(data);
        }
      } catch { /* opsiyonel */ }

      // Adım 4: SHAP
      setMlStep(ML_STEPS[4]);
      try {
        const shapRes = await fetch(`${ML_API}/feature-importance`);
        if (shapRes.ok) {
          const shapData = await shapRes.json();
          if (shapData.features?.length > 0) setFeatures(shapData.features);
        }
      } catch { /* opsiyonel */ }

      setMlLoaded(true);
      setReadingsVersion((v) => v + 1);
    } catch {
      setMlError("ML API bağlantı hatası");
    } finally {
      setMlLoading(false);
      setMlStep(null);
    }
  }, [mlLoading, model, tablePeriodDays]);

  // ── Verileri Güncelle butonu — EPİAŞ'tan taze veri çek ──
  const handleRefreshData = useCallback(async () => {
    if (dataRefreshing) return;
    setDataRefreshing(true);
    setRefreshMsg("EPİAŞ'tan veriler çekiliyor...");

    try {
      const healthRes = await fetch(`${ML_API}/health`, { signal: AbortSignal.timeout(10000) });
      if (!healthRes.ok) {
        setRefreshMsg("ML API sunucusuna ulaşılamıyor");
        setDataRefreshing(false);
        return;
      }

      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 3600000);
      const updateRes = await fetch(`${ML_API}/update-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_date: from.toISOString().slice(0, 10),
          to_date: now.toISOString().slice(0, 10),
        }),
      });

      let rowCount = 0;
      if (updateRes.ok) {
        const updateData = await updateRes.json();
        rowCount = updateData.rows_inserted || 0;
      }

      // Supabase'den güncel veriyi yükle
      const energyRes = await fetch(
        `/api/energy?from=${from.toISOString()}&to=${now.toISOString()}&limit=${7 * 24}`
      );
      if (energyRes.ok) {
        const energyData = await energyRes.json();
        const readings: EnergyReading[] = energyData.data || [];
        const sorted = sortReadings(readings);
        if (sorted.length > 0) {
          readingsRef.current = { periodKey: "7", sorted };
          setHeatmap(buildHeatmapFromReadings(sorted));
          setTimeline(buildTimelineFromReadings(sorted, []));
          tableReadingsRef.current = { periodKey: "1", sorted: sorted.slice(-24) };
          setTableRows(buildTableRows(sorted.slice(-24), tablePredsRef.current));
          setDataLoaded(true);
          setReadingsVersion((v) => v + 1);
        }
      }

      setRefreshMsg(`${rowCount} satır güncellendi`);
    } catch {
      setRefreshMsg("Bağlantı hatası");
    } finally {
      setDataRefreshing(false);
      setTimeout(() => setRefreshMsg(null), 8000);
    }
  }, [dataRefreshing]);

  // ── 1) Başlangıç: Supabase'den enerji verisi yükle (ML API'ye dokunma) ──
  useEffect(() => {
    async function init() {
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
            setTimeline(buildTimelineFromReadings(sorted, []));
            tableReadingsRef.current = { periodKey: "1", sorted: sorted.slice(-24) };
            setTableRows(buildTableRows(sorted.slice(-24), { prophet: [], xgboost: [] }));
            setDataLoaded(true);
            setReadingsVersion((v) => v + 1);
          }
        }
      } catch {
        // Supabase'e erişilemezse boş kalır
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
      } catch {
        // veri yüklenemezse boş kalır
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodDays, dataLoaded]);

  // ── 3) Model veya period değiştiğinde → timeline güncelle ──
  useEffect(() => {
    const sorted = readingsRef.current.sorted;
    if (sorted.length === 0) return;

    if (!mlLoaded) {
      setTimeline(buildTimelineFromReadings(sorted, []));
      return;
    }

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
  }, [model, periodDays, readingsVersion, mlLoaded]);

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
      } catch {
        // veri yüklenemezse boş kalır
      }
    }

    loadTableData();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablePeriod, tablePeriodDays, readingsVersion, dataLoaded]);

  // ── Metrikler hesapla ──
  const tableMetrics = tableRows && tableRows.length > 0
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

  const tl = timeline;
  const hm = heatmap;
  const tr = tableRows || [];

  // KPI — ana period filtresine bağlı (readingsRef)
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

        {!mlLoaded && (
          <Button
            size="sm"
            onClick={handleLoadML}
            disabled={mlLoading}
            className="self-start"
          >
            {mlLoading ? "Tahminler yükleniyor..." : "Tahminleri Al"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshData}
          disabled={dataRefreshing}
          className="self-start"
        >
          {dataRefreshing ? "Güncelleniyor..." : "Verileri Güncelle"}
        </Button>

        {refreshMsg && (
          <span className="self-start rounded-md bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {refreshMsg}
          </span>
        )}
        {mlLoaded && (
          <span className="self-start rounded-md bg-green-100 px-3 py-1 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
            ML API bağlı
          </span>
        )}
      </div>

      {/* ML API yükleniyor banner */}
      {mlLoading && mlStep && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">{mlStep}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {ML_STEPS.indexOf(mlStep) + 1}/{ML_STEPS.length}
            </span>
          </div>
        </div>
      )}
      {mlError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {mlError}
        </div>
      )}

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
        {mlLoaded ? (
          <ModelComparison
            periodData={periodData}
            tableMetrics={tableMetrics}
          />
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg">Model Karşılaştırma</CardTitle></CardHeader>
            <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
              {mlLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>Modeller karşılaştırılıyor...</span>
                </div>
              ) : (
                <span>Tahminleri yüklemek için &quot;Tahminleri Al&quot; butonuna tıklayın</span>
              )}
            </CardContent>
          </Card>
        )}

        {mlLoaded ? (
          <FeatureImportance features={features} />
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base sm:text-lg">Özellik Önemi (XGBoost SHAP)</CardTitle></CardHeader>
            <CardContent className="flex h-48 flex-col items-center justify-center gap-3 text-muted-foreground text-sm">
              {mlLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  <span>SHAP değerleri hesaplanıyor...</span>
                </div>
              ) : (
                <span>Tahminleri yüklemek için &quot;Tahminleri Al&quot; butonuna tıklayın</span>
              )}
            </CardContent>
          </Card>
        )}
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
