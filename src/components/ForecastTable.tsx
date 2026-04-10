"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Download } from "lucide-react";

interface ForecastRow {
  hour: string;
  actual: number;
  prophet: number;
  xgboost: number;
  sarima: number;
}

interface ForecastTableProps {
  rows: ForecastRow[];
}

function errorPercent(actual: number, predicted: number): number {
  if (actual === 0) return 0;
  return Math.abs((actual - predicted) / actual) * 100;
}

function errorColor(pct: number): string {
  if (pct < 5) return "text-green-600 dark:text-green-400";
  if (pct < 10) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function errorBg(pct: number): string {
  if (pct < 5) return "bg-green-50 dark:bg-green-950/30";
  if (pct < 10) return "bg-yellow-50 dark:bg-yellow-950/30";
  return "bg-red-50 dark:bg-red-950/30";
}

export function ForecastTable({ rows }: ForecastTableProps) {
  const exportCSV = useCallback(() => {
    const header = "Saat,Gerçek,Prophet,XGBoost,SARIMA,Prophet Hata %,XGBoost Hata %,SARIMA Hata %\n";
    const csvRows = rows.map((r) => {
      const pe = errorPercent(r.actual, r.prophet).toFixed(1);
      const xe = errorPercent(r.actual, r.xgboost).toFixed(1);
      const se = errorPercent(r.actual, r.sarima).toFixed(1);
      return `${r.hour},${r.actual},${r.prophet},${r.xgboost},${r.sarima},${pe},${xe},${se}`;
    });
    const blob = new Blob([header + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tahmin_verileri.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  return (
    <Card data-onboarding="forecast-table">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center justify-between text-base sm:text-lg">
          <span className="flex items-center gap-2">
            Tahmin Veri Tablosu
            <InfoTooltip text="Her saat için gerçek tüketim ve 3 modelin tahmin değerlerini gösterir. Hata sütunları yüzde sapmayı belirtir: yeşil %5 altı (iyi), sarı %5-10 (orta), kırmızı %10 üstü (düşük doğruluk). CSV butonu ile verileri indirebilirsiniz." />
          </span>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" />
            CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-2 font-medium sm:p-3">Saat</th>
                <th className="p-2 font-medium text-right sm:p-3">Gerçek</th>
                <th className="p-2 font-medium text-right sm:p-3">Prophet</th>
                <th className="p-2 font-medium text-right sm:p-3">Hata</th>
                <th className="p-2 font-medium text-right sm:p-3">XGBoost</th>
                <th className="p-2 font-medium text-right sm:p-3">Hata</th>
                <th className="p-2 font-medium text-right sm:p-3">SARIMA</th>
                <th className="p-2 font-medium text-right sm:p-3">Hata</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const pe = errorPercent(row.actual, row.prophet);
                const xe = errorPercent(row.actual, row.xgboost);
                const se = errorPercent(row.actual, row.sarima);
                return (
                  <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-2 font-medium sm:p-3">{row.hour}</td>
                    <td className="p-2 text-right sm:p-3">{row.actual.toLocaleString("tr-TR")}</td>
                    <td className="p-2 text-right sm:p-3">{row.prophet.toLocaleString("tr-TR")}</td>
                    <td className={`p-2 text-right font-mono sm:p-3 ${errorColor(pe)} ${errorBg(pe)} rounded`}>
                      {pe.toFixed(1)}%
                    </td>
                    <td className="p-2 text-right sm:p-3">{row.xgboost.toLocaleString("tr-TR")}</td>
                    <td className={`p-2 text-right font-mono sm:p-3 ${errorColor(xe)} ${errorBg(xe)} rounded`}>
                      {xe.toFixed(1)}%
                    </td>
                    <td className="p-2 text-right sm:p-3">{row.sarima.toLocaleString("tr-TR")}</td>
                    <td className={`p-2 text-right font-mono sm:p-3 ${errorColor(se)} ${errorBg(se)} rounded`}>
                      {se.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
