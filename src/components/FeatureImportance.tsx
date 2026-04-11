"use client";

import { Bar } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "@/lib/chart-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface Feature {
  name: string;
  feature: string;
  shap_value: number;
}

interface FeatureImportanceProps {
  features: Feature[];
}

export function FeatureImportance({ features }: FeatureImportanceProps) {
  if (!features || features.length === 0) {
    return (
      <Card data-onboarding="feature-importance">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            Özellik Önemi (XGBoost SHAP)
            <InfoTooltip text="SHAP (SHapley Additive exPlanations) değerleri, her özelliğin tahmin üzerindeki etkisini gösterir. Daha yüksek değer, o özelliğin model kararına daha fazla etki ettiğini gösterir." />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center text-muted-foreground text-sm">
          SHAP verileri henüz mevcut değil. Modeller eğitildikten sonra burada görünecek.
        </CardContent>
      </Card>
    );
  }

  const sorted = [...features].sort((a, b) => b.shap_value - a.shap_value);
  const maxVal = sorted[0]?.shap_value ?? 1;

  const data: ChartData<"bar"> = {
    labels: sorted.map((f) => f.name),
    datasets: [
      {
        label: "SHAP Değeri",
        data: sorted.map((f) => f.shap_value),
        backgroundColor: sorted.map((f) => {
          const ratio = f.shap_value / maxVal;
          return `rgba(59, 130, 246, ${0.3 + ratio * 0.7})`;
        }),
        borderRadius: 4,
      },
    ],
  };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `SHAP: ${Number(ctx.parsed.x).toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Ortalama |SHAP değeri|" },
        beginAtZero: true,
      },
    },
  };

  return (
    <Card data-onboarding="feature-importance">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          Özellik Önemi (XGBoost SHAP)
          <InfoTooltip text="SHAP (SHapley Additive exPlanations) değerleri, her özelliğin tahmin üzerindeki etkisini gösterir. Daha yüksek değer, o özelliğin model kararına daha fazla etki ettiğini gösterir. Örneğin '1 Saat Önceki Tüketim' en etkili özellikse, tüketim en çok yakın geçmiş veriye bağlı demektir." />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[300px] sm:h-[350px] lg:h-[400px]">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
