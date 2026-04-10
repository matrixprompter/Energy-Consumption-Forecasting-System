"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
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
  { value: "7d", label: "7 Gün" },
  { value: "30d", label: "30 Gün" },
  { value: "90d", label: "90 Gün" },
  { value: "1y", label: "1 Yıl" },
];

const MODEL_OPTIONS = [
  { value: "xgboost", label: "XGBoost" },
  { value: "prophet", label: "Prophet" },
  { value: "sarima", label: "SARIMA" },
];

// Seeded random — aynı seed = aynı sayılar (hydration güvenli)
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
  return Array.from({ length: count }, (_, i) => {
    const hourFactor = -Math.cos((i / 24) * Math.PI * 2) * 5000;
    const base = 30000 + hourFactor;
    return {
      hour: `${String(i % 24).padStart(2, "0")}:00`,
      actual: Math.round(base + (rand() - 0.5) * 1000),
      prophet: Math.round(base + (rand() - 0.5) * 2000),
      xgboost: Math.round(base + (rand() - 0.5) * 1200),
      sarima: Math.round(base + (rand() - 0.5) * 2500),
    };
  });
}

const DEMO_METRICS = {
  prophet: { mape: 4.2, rmse: 1250, mae: 980, r2: 0.92 },
  xgboost: { mape: 3.8, rmse: 1100, mae: 870, r2: 0.95 },
  sarima: { mape: 5.1, rmse: 1500, mae: 1150, r2: 0.89 },
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

interface DemoData {
  timeline: ReturnType<typeof generateDemoTimeline>;
  heatmap: number[][];
  tableRows: ReturnType<typeof generateDemoTableRows>;
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("7d");
  const [model, setModel] = useState("xgboost");
  const [apiAvailable, setApiAvailable] = useState(false);
  const [comparison, setComparison] = useState(DEMO_METRICS);
  const [features, setFeatures] = useState(DEMO_FEATURES);
  const [winner, setWinner] = useState("xgboost");
  const [demoData, setDemoData] = useState<DemoData | null>(null);

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;

  // Demo veriler sadece client-side üretilir (hydration sorunu yok)
  useEffect(() => {
    setDemoData({
      timeline: generateDemoTimeline(periodDays > 30 ? 30 : periodDays),
      heatmap: generateDemoHeatmap(),
      tableRows: generateDemoTableRows(24),
    });
  }, [periodDays]);

  const checkApi = useCallback(async () => {
    try {
      const res = await fetch(`${ML_API}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        setApiAvailable(true);
        const compRes = await fetch(`${ML_API}/model-comparison`);
        if (compRes.ok) {
          const data = await compRes.json();
          setComparison({
            prophet: data.prophet || DEMO_METRICS.prophet,
            xgboost: data.xgboost || DEMO_METRICS.xgboost,
            sarima: data.sarima || DEMO_METRICS.sarima,
          });
          setWinner(data.winner || "xgboost");
        }
        const shapRes = await fetch(`${ML_API}/feature-importance`);
        if (shapRes.ok) {
          const shapData = await shapRes.json();
          if (shapData.features?.length > 0) setFeatures(shapData.features);
        }
      }
    } catch {
      setApiAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkApi();
  }, [checkApi]);

  if (!demoData) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  const { timeline, heatmap, tableRows } = demoData;

  const avgConsumption = timeline.actual.reduce((a, b) => a + b, 0) / timeline.actual.length;
  const hourlyTotals = Array.from({ length: 24 }, (_, h) =>
    timeline.actual.filter((_, i) => i % 24 === h).reduce((a, b) => a + b, 0)
  );
  const peakHour = hourlyTotals.indexOf(Math.max(...hourlyTotals));
  const bestMape = Math.min(comparison.prophet.mape, comparison.xgboost.mape, comparison.sarima.mape);

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
      </div>

      {/* KPI Kartları */}
      <KPICards
        avgConsumption={avgConsumption}
        peakHour={peakHour}
        bestAccuracy={bestMape}
        bestModel={winner}
      />

      {/* Ana Tahmin Grafiği */}
      <ForecastChart
        labels={timeline.labels}
        actual={timeline.actual}
        predicted={timeline.predicted}
        lower={timeline.lower}
        upper={timeline.upper}
        modelName={model}
      />

      {/* Model Karşılaştırma + Özellik Önemi */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ModelComparison
          prophet={comparison.prophet}
          xgboost={comparison.xgboost}
          sarima={comparison.sarima}
          winner={winner}
        />
        <FeatureImportance features={features} />
      </div>

      {/* Isı Haritası */}
      <HeatmapChart data={heatmap} />

      {/* Senaryo + Export */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <ScenarioAnalysis />
        <ExportPanel
          forecastData={tableRows}
          modelMetrics={comparison}
        />
      </div>

      {/* Tahmin Tablosu */}
      <ForecastTable rows={tableRows} />
    </div>
  );
}
