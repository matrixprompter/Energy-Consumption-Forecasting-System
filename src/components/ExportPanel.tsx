"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { FileText, FileSpreadsheet, FileDown } from "lucide-react";

interface ForecastRow {
  hour: string;
  actual: number;
  prophet: number;
  xgboost: number;
  sarima: number;
}

interface ExportPanelProps {
  dashboardId?: string;
  forecastData?: ForecastRow[];
  modelMetrics?: Record<string, Record<string, number>>;
}

export function ExportPanel({
  dashboardId = "dashboard-content",
  forecastData = [],
  modelMetrics = {},
}: ExportPanelProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportPDF() {
    setExporting("pdf");
    try {
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      // Başlık
      pdf.setFontSize(20);
      pdf.text("Enerji Tuketim Tahmin Raporu", 14, 20);
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Olusturulma: ${new Date().toLocaleString("tr-TR")}`, 14, 28);

      // Model Performans Özeti
      pdf.setTextColor(0);
      pdf.setFontSize(14);
      pdf.text("Model Performans Ozeti", 14, 42);

      let yPos = 52;
      pdf.setFontSize(10);

      // Tablo başlıkları
      pdf.setFont("helvetica", "bold");
      pdf.text("Model", 14, yPos);
      pdf.text("MAPE (%)", 60, yPos);
      pdf.text("RMSE", 100, yPos);
      pdf.text("MAE", 135, yPos);
      pdf.text("R2", 165, yPos);
      yPos += 2;
      pdf.line(14, yPos, pageWidth - 14, yPos);
      yPos += 6;

      pdf.setFont("helvetica", "normal");
      for (const [model, metrics] of Object.entries(modelMetrics)) {
        const m = metrics as Record<string, number>;
        pdf.text(model.toUpperCase(), 14, yPos);
        pdf.text(String(m.mape), 60, yPos);
        pdf.text(String(m.rmse), 100, yPos);
        pdf.text(String(m.mae), 135, yPos);
        pdf.text(String(m.r2 ?? "-"), 165, yPos);
        yPos += 7;
      }

      // Tahmin Verileri Tablosu
      yPos += 10;
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Saatlik Tahmin Verileri", 14, yPos);
      yPos += 10;

      pdf.setFontSize(8);
      pdf.text("Saat", 14, yPos);
      pdf.text("Gercek", 35, yPos);
      pdf.text("Prophet", 65, yPos);
      pdf.text("XGBoost", 95, yPos);
      pdf.text("SARIMA", 125, yPos);
      yPos += 2;
      pdf.line(14, yPos, pageWidth - 14, yPos);
      yPos += 5;

      pdf.setFont("helvetica", "normal");
      for (const row of forecastData.slice(0, 24)) {
        if (yPos > 275) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(row.hour, 14, yPos);
        pdf.text(row.actual.toLocaleString("tr-TR"), 35, yPos);
        pdf.text(row.prophet.toLocaleString("tr-TR"), 65, yPos);
        pdf.text(row.xgboost.toLocaleString("tr-TR"), 95, yPos);
        pdf.text(row.sarima.toLocaleString("tr-TR"), 125, yPos);
        yPos += 6;
      }

      pdf.save("enerji_tahmin_raporu.pdf");
    } finally {
      setExporting(null);
    }
  }

  async function exportExcel() {
    setExporting("excel");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (forecastData.length > 0) {
        const rows = forecastData.map((r) => ({
          Saat: r.hour,
          "Gerçek": r.actual,
          Prophet: r.prophet,
          XGBoost: r.xgboost,
          SARIMA: r.sarima,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Tahmin Verileri");
      }

      const metricsRows = Object.entries(modelMetrics).map(([model, metrics]) => ({
        Model: model.toUpperCase(),
        ...(metrics as Record<string, number>),
      }));
      if (metricsRows.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(metricsRows);
        XLSX.utils.book_append_sheet(wb, ws2, "Model Metrikleri");
      }

      XLSX.writeFile(wb, "enerji_tahmin_verileri.xlsx");
    } finally {
      setExporting(null);
    }
  }

  function exportCSV() {
    if (forecastData.length === 0) return;
    const header = "Saat,Gerçek,Prophet,XGBoost,SARIMA\n";
    const csvRows = forecastData.map((r) =>
      `${r.hour},${r.actual},${r.prophet},${r.xgboost},${r.sarima}`
    );
    const blob = new Blob([header + csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "enerji_tahmin_verileri.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card data-onboarding="export">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          Rapor Aktar
          <InfoTooltip text="Tahmin verilerini ve model metriklerini PDF, Excel veya CSV formatında indirebilirsiniz. PDF raporu model karşılaştırma tablosu ve saatlik tahmin verilerini içerir." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        {/* Veri Önizleme */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Aktarılacak Veriler</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Tahmin satırları:</span>{" "}
              <span className="font-medium">{forecastData.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model sayısı:</span>{" "}
              <span className="font-medium">{Object.keys(modelMetrics).length}</span>
            </div>
            {Object.entries(modelMetrics).map(([model, m]) => (
              <div key={model} className="col-span-2 flex items-center gap-2">
                <span className="font-medium uppercase">{model}</span>
                <span className="text-muted-foreground">
                  MAPE: {(m as Record<string, number>).mape}% | RMSE: {(m as Record<string, number>).rmse}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Export butonları */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <Button onClick={exportPDF} disabled={exporting !== null} variant="outline" className="w-full sm:w-auto">
            <FileText className="mr-2 h-4 w-4" />
            {exporting === "pdf" ? "Hazırlanıyor..." : "PDF Rapor"}
          </Button>
          <Button onClick={exportExcel} disabled={exporting !== null} variant="outline" className="w-full sm:w-auto">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {exporting === "excel" ? "Hazırlanıyor..." : "Excel"}
          </Button>
          <Button onClick={exportCSV} variant="outline" className="w-full sm:w-auto">
            <FileDown className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
