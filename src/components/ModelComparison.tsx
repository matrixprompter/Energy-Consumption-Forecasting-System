"use client";

import { useState } from "react";
import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "@/lib/chart-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export interface ModelMetrics {
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
  /** Son 24 saat tablo verisinden hesaplanan metrikler (opsiyonel) */
  tableMetrics?: {
    prophet: ModelMetrics;
    xgboost: ModelMetrics;
    sarima: ModelMetrics;
    winner: string;
  } | null;
}

const METRIC_LABELS = ["MAPE (%)", "RMSE", "MAE", "R\u00B2"];
const METRIC_KEYS: (keyof ModelMetrics)[] = ["mape", "rmse", "mae", "r2"];

const PERIOD_TABS = [
  { key: "24h", label: "Son 24 Saat" },
  { key: "general", label: "Genel (7 Gün)" },
] as const;

type PeriodTab = (typeof PERIOD_TABS)[number]["key"];

function getBestIndex(values: number[], metric: string): number {
  if (metric === "r2") return values.indexOf(Math.max(...values));
  return values.indexOf(Math.min(...values));
}

export function ModelComparison({
  prophet,
  xgboost,
  sarima,
  winner,
  tableMetrics,
}: ModelComparisonProps) {
  const [tab, setTab] = useState<PeriodTab>(tableMetrics ? "24h" : "general");

  const is24h = tab === "24h" && tableMetrics;
  const currentProphet = is24h ? tableMetrics.prophet : prophet;
  const currentXgboost = is24h ? tableMetrics.xgboost : xgboost;
  const currentSarima = is24h ? tableMetrics.sarima : sarima;
  const currentWinner = is24h ? tableMetrics.winner : winner;

  const models = [currentProphet, currentXgboost, currentSarima];
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
    <Card data-onboarding="model-comparison">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex flex-col gap-1 text-base sm:text-lg">
          <span className="flex items-center gap-2">
            Model Karşılaştırma
            <InfoTooltip text="Prophet, XGBoost ve SARIMA modellerinin performans metriklerini karşılaştırır. 'Son 24 Saat' sekmesi tablodaki son 24 saatlik gerçek vs tahmin verisinden hesaplanır. 'Genel (7 Gün)' sekmesi eğitim sonrası 7 günlük test penceresinden hesaplanır." />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-normal text-muted-foreground sm:text-sm">
              Kazanan: <span className="font-semibold text-green-600">{currentWinner.toUpperCase()}</span>
            </span>
          </div>
        </CardTitle>
        {/* Period tabs */}
        <div className="flex gap-1 pt-1">
          {PERIOD_TABS.map((t) => {
            const disabled = t.key === "24h" && !tableMetrics;
            return (
              <button
                key={t.key}
                disabled={disabled}
                onClick={() => !disabled && setTab(t.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? "bg-primary text-primary-foreground"
                    : disabled
                      ? "cursor-not-allowed text-muted-foreground/50"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[250px] sm:h-[300px] lg:h-[350px]">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
