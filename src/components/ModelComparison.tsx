"use client";

import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "@/lib/chart-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface ModelMetrics {
  mape: number;
  rmse: number;
  mae: number;
  r2: number;
}

interface ModelComparisonProps {
  prophet: ModelMetrics;
  xgboost: ModelMetrics;
  sarima: ModelMetrics;
  winner: string;
}

const METRIC_LABELS = ["MAPE (%)", "RMSE", "MAE", "R\u00B2"];
const METRIC_KEYS: (keyof ModelMetrics)[] = ["mape", "rmse", "mae", "r2"];

function getBestIndex(values: number[], metric: string): number {
  if (metric === "r2") return values.indexOf(Math.max(...values));
  return values.indexOf(Math.min(...values));
}

export function ModelComparison({ prophet, xgboost, sarima, winner }: ModelComparisonProps) {
  const models = [prophet, xgboost, sarima];
  const modelNames = ["Prophet", "XGBoost", "SARIMA"];
  const baseColors = ["rgba(249,115,22,0.8)", "rgba(34,197,94,0.8)", "rgba(239,68,68,0.8)"];
  const greenHighlight = "rgba(22,163,74,0.9)";

  const datasets = modelNames.map((name, mIdx) => ({
    label: name,
    data: METRIC_KEYS.map((k) => models[mIdx][k]),
    backgroundColor: METRIC_KEYS.map((_, kIdx) => {
      const values = models.map((m) => m[METRIC_KEYS[kIdx]]);
      const best = getBestIndex(values, METRIC_KEYS[kIdx]);
      return best === mIdx ? greenHighlight : baseColors[mIdx];
    }),
    borderRadius: 4,
  }));

  const data: ChartData<"bar"> = { labels: METRIC_LABELS, datasets };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}`,
        },
      },
    },
    scales: { y: { beginAtZero: true } },
  };

  return (
    <Card className="overflow-hidden" data-onboarding="model-comparison">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex flex-col gap-1 text-base sm:text-lg">
          <span className="flex items-center gap-2">
            Model Karşılaştırma
            <InfoTooltip text="Prophet, XGBoost ve SARIMA modellerinin performans metriklerini karşılaştırır. MAPE: ortalama yüzde hata, RMSE: kök ortalama kare hata, MAE: ortalama mutlak hata, R²: belirlilik katsayısı. Yeşil çubuklar her metrikte en iyi modeli vurgular." />
          </span>
          <span className="text-xs font-normal text-muted-foreground sm:text-sm">
            Kazanan: <span className="font-semibold text-green-600">{winner.toUpperCase()}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[250px] sm:h-[300px] lg:h-[350px]">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
