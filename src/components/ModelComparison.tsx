"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

export interface ModelMetrics {
  mape: number;
  rmse: number;
  mae: number;
  r2: number;
}

export interface PeriodComparison {
  prophet: ModelMetrics;
  xgboost: ModelMetrics;
  winner: string;
}

interface ModelComparisonProps {
  periodData: Record<string, PeriodComparison>;
  tableMetrics?: PeriodComparison | null;
}

const METRICS = [
  {
    key: "mape" as const,
    label: "MAPE (%)",
    desc: "Ortalama Mutlak Yuzde Hata — dusuk = iyi",
    lower: true,
    fmt: (v: number) => `${v.toFixed(2)}%`,
  },
  {
    key: "rmse" as const,
    label: "RMSE",
    desc: "Kok Ortalama Kare Hata — buyuk sapmalara duyarli, dusuk = iyi",
    lower: true,
    fmt: (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }),
  },
  {
    key: "mae" as const,
    label: "MAE",
    desc: "Ortalama Mutlak Hata — ortalama sapma buyuklugu, dusuk = iyi",
    lower: true,
    fmt: (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 0 }),
  },
  {
    key: "r2" as const,
    label: "R\u00B2",
    desc: "Belirleme katsayisi — modelin veriyi ne kadar aciklayabildigini gosterir, 1'e yakin = iyi",
    lower: false,
    fmt: (v: number) => v.toFixed(4),
  },
];

const PERIOD_TABS = [
  { key: "live24h", label: "Son 24 Saat" },
  { key: "1d", label: "1 Gün" },
  { key: "7d", label: "7 Gün" },
  { key: "30d", label: "1 Ay" },
  { key: "90d", label: "3 Ay" },
  { key: "180d", label: "6 Ay" },
  { key: "1y", label: "1 Yıl" },
] as const;

type PeriodTab = (typeof PERIOD_TABS)[number]["key"];

export function ModelComparison({
  periodData,
  tableMetrics,
}: ModelComparisonProps) {
  const defaultTab: PeriodTab = tableMetrics
    ? "live24h"
    : (Object.keys(periodData)[0] as PeriodTab) || "7d";
  const [tab, setTab] = useState<PeriodTab>(defaultTab);

  let currentData: PeriodComparison | null = null;
  if (tab === "live24h") {
    currentData = tableMetrics || null;
  } else {
    currentData = periodData[tab] || null;
  }

  if (!currentData) {
    const firstKey = Object.keys(periodData)[0];
    currentData = firstKey ? periodData[firstKey] : null;
  }

  if (!currentData) {
    return (
      <Card data-onboarding="model-comparison">
        <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
          Model karsilastirma verisi bulunamadi
        </CardContent>
      </Card>
    );
  }

  const models = { prophet: currentData.prophet, xgboost: currentData.xgboost };
  const currentWinner = currentData.winner;
  const hasR2 = models.prophet.r2 !== undefined && models.xgboost.r2 !== undefined;
  const visibleMetrics = hasR2 ? METRICS : METRICS.filter((m) => m.key !== "r2");

  return (
    <Card data-onboarding="model-comparison">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex flex-col gap-1 text-base sm:text-lg">
          <span className="flex items-center gap-2">
            Model Karsilastirma
            <InfoTooltip text="Prophet ve XGBoost modellerinin farkli zaman periyotlarindaki performansini karsilastirir. Yesil arka plan her metrikte en iyi degeri vurgular. MAPE, RMSE, MAE dusuk olmasi iyidir; R2 yuksek olmasi iyidir." />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-normal text-muted-foreground sm:text-sm">
              Kazanan: <span className="font-semibold text-green-600">{currentWinner.toUpperCase()}</span>
            </span>
          </div>
        </CardTitle>
        <div className="flex flex-wrap gap-1 pt-1">
          {PERIOD_TABS.map((t) => {
            const disabled =
              (t.key === "live24h" && !tableMetrics) ||
              (t.key !== "live24h" && !periodData[t.key]);
            return (
              <button
                key={t.key}
                disabled={disabled}
                onClick={() => !disabled && setTab(t.key)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors sm:px-3 sm:text-xs ${
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
      <CardContent className="px-4 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium sm:p-3">Metrik</th>
                <th className="p-2 text-right font-medium sm:p-3">Prophet</th>
                <th className="p-2 text-right font-medium sm:p-3">XGBoost</th>
              </tr>
            </thead>
            <tbody>
              {visibleMetrics.map((metric) => {
                const pVal = models.prophet[metric.key] ?? 0;
                const xVal = models.xgboost[metric.key] ?? 0;
                const pBest = metric.lower ? pVal <= xVal : pVal >= xVal;
                const xBest = metric.lower ? xVal <= pVal : xVal >= pVal;

                return (
                  <tr key={metric.key} className="border-b last:border-0 h-11">
                    <td className="p-2 py-3 sm:p-3">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{metric.label}</span>
                        <InfoTooltip text={metric.desc} />
                      </div>
                    </td>
                    <td className={`p-2 text-right font-mono sm:p-3 ${pBest ? "bg-green-50 font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"}`}>
                      {metric.fmt(pVal)}
                    </td>
                    <td className={`p-2 text-right font-mono sm:p-3 ${xBest ? "bg-green-50 font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"}`}>
                      {metric.fmt(xVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-3 border-t pt-3">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground sm:text-xs">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800" />
              Kazanan (en iyi deger)
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800" />
              Kaybeden
            </span>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
            Degerlendirme, secilen periyottaki tum saatlik veriler uzerinde kayar pencere (rolling 24-step forecast) yontemiyle yapilir. Her adimda model sadece gecmis veriyi gorup sonraki 24 saati tahmin eder; boylece gercek zamana yakin bir test ortami olusturulur. MAPE ve MAE mutlak sapmayi, RMSE buyuk hatalara duyarliligi, R² ise modelin toplam varyansi aciklama oranini olcer. Dusuk MAPE/RMSE/MAE ve yuksek R² daha iyi performans gosterir.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
