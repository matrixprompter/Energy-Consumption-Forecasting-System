"use client";

import { useRef } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import "@/lib/chart-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface ForecastChartProps {
  labels: string[];
  actual: number[];
  predicted: number[];
  lower: number[];
  upper: number[];
  modelName: string;
}

export function ForecastChart({
  labels,
  actual,
  predicted,
  lower,
  upper,
  modelName,
}: ForecastChartProps) {
  const chartRef = useRef(null);

  const data: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "Gerçek",
        data: actual,
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: `${modelName.toUpperCase()} Tahmini`,
        data: predicted,
        borderColor: "rgb(249, 115, 22)",
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 0,
        tension: 0.3,
      },
      {
        label: "Üst Sınır",
        data: upper,
        borderColor: "transparent",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        fill: "+1",
        pointRadius: 0,
      },
      {
        label: "Alt Sınır",
        data: lower,
        borderColor: "transparent",
        backgroundColor: "rgba(59, 130, 246, 0.08)",
        fill: "-1",
        pointRadius: 0,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toLocaleString("tr-TR")} MWh`,
        },
      },
      zoom: {
        zoom: {
          wheel: { enabled: true },
          pinch: { enabled: true },
          mode: "x",
        },
        pan: { enabled: true, mode: "x" },
      },
    },
    scales: {
      x: {
        type: "time",
        time: { unit: "hour", displayFormats: { hour: "dd MMM HH:mm" } },
        title: { display: true, text: "Zaman" },
      },
      y: {
        title: { display: true, text: "Tüketim (MWh)" },
        ticks: { callback: (val) => Number(val).toLocaleString("tr-TR") },
      },
    },
  };

  return (
    <Card data-onboarding="forecast-chart">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          Enerji Tüketim Tahmini
          <InfoTooltip text="Mavi çizgi gerçek tüketim verilerini, turuncu kesikli çizgi seçilen modelin tahminini gösterir. Açık mavi alan %95 güven aralığını temsil eder. Fare tekerleğiyle yakınlaştırabilir, sürükleme ile kaydırabilirsiniz." />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="h-[250px] sm:h-[350px] lg:h-[400px]">
          <Line ref={chartRef} data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
