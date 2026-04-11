"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface HeatmapChartProps {
  data: number[][];
  dayLabels?: string[];
}

const DEFAULT_DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

function getColor(value: number, min: number, max: number): string {
  const ratio = max === min ? 0 : (value - min) / (max - min);
  const r = Math.round(255 - ratio * 200);
  const g = Math.round(255 - ratio * 200);
  const b = 255;
  return `rgb(${r}, ${g}, ${b})`;
}

function getTextColor(value: number, min: number, max: number): string {
  const ratio = max === min ? 0 : (value - min) / (max - min);
  return ratio > 0.6 ? "white" : "rgb(30, 30, 30)";
}

export function HeatmapChart({ data, dayLabels = DEFAULT_DAYS }: HeatmapChartProps) {
  const { min, max, peakHour, peakDay } = useMemo(() => {
    let minVal = Infinity;
    let maxVal = -Infinity;
    let peakD = 0;
    let peakH = 0;

    for (let d = 0; d < data.length; d++) {
      for (let h = 0; h < (data[d]?.length ?? 0); h++) {
        const v = data[d][h];
        if (v < minVal) minVal = v;
        if (v > maxVal) {
          maxVal = v;
          peakD = d;
          peakH = h;
        }
      }
    }

    return { min: minVal, max: maxVal, peakHour: peakH, peakDay: peakD };
  }, [data]);

  return (
    <Card data-onboarding="heatmap">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex flex-col gap-1 text-base sm:text-lg">
          <span className="flex items-center gap-2">
            Saatlik Tüketim Isı Haritası
            <InfoTooltip text="Haftanın her günü ve her saati için enerji tüketimini gösterir. Koyu mavi yüksek tüketimi, açık renk düşük tüketimi temsil eder. Kırmızı çerçeveli hücre en yüksek tüketim (pik) noktasını belirtir. Hücrelerin üzerine gelerek detaylı değerleri görebilirsiniz." />
          </span>
          <span className="text-xs font-normal text-muted-foreground sm:text-sm">
            Pik: {dayLabels[peakDay]} {HOURS[peakHour]}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] sm:text-xs">
            <thead>
              <tr>
                <th className="p-1 text-left text-muted-foreground">Gün</th>
                {HOURS.map((h) => (
                  <th key={h} className="p-0.5 text-center text-muted-foreground font-normal sm:p-1">
                    {h.slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, dIdx) => (
                <tr key={dIdx}>
                  <td className="p-1 font-medium whitespace-nowrap">{dayLabels[dIdx]}</td>
                  {row.map((val, hIdx) => {
                    const isPeak = dIdx === peakDay && hIdx === peakHour;
                    return (
                      <td
                        key={hIdx}
                        className="p-0.5 text-center sm:p-1"
                        title={`${dayLabels[dIdx]} ${HOURS[hIdx]}: ${val.toLocaleString("tr-TR")} MWh`}
                      >
                        <div
                          className="rounded-sm px-0.5 py-1 text-[8px] leading-none sm:px-1 sm:py-1.5 sm:text-[10px]"
                          style={{
                            backgroundColor: val === 0 ? "rgb(240,240,240)" : getColor(val, min, max),
                            color: val === 0 ? "rgb(160,160,160)" : getTextColor(val, min, max),
                            outline: isPeak ? "2px solid rgb(220, 38, 38)" : "none",
                          }}
                        >
                          {val === 0 ? "-" : `${(val / 1000).toFixed(1)}k`}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground sm:text-xs">
          <span>Düşük</span>
          <div className="flex gap-0.5">
            {[0, 0.25, 0.5, 0.75, 1].map((r) => (
              <div
                key={r}
                className="h-3 w-6 rounded-sm"
                style={{ backgroundColor: getColor(min + r * (max - min), min, max) }}
              />
            ))}
          </div>
          <span>Yüksek</span>
        </div>
      </CardContent>
    </Card>
  );
}
