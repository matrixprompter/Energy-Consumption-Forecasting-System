"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Activity } from "lucide-react";

const ML_API_URL = process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000";

const DAY_OPTIONS = [
  { value: "0", label: "Pazartesi" },
  { value: "1", label: "Salı" },
  { value: "2", label: "Çarşamba" },
  { value: "3", label: "Perşembe" },
  { value: "4", label: "Cuma" },
  { value: "5", label: "Cumartesi" },
  { value: "6", label: "Pazar" },
];

export function ScenarioAnalysis() {
  const [temp, setTemp] = useState(20);
  const [hour, setHour] = useState(12);
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [isHoliday, setIsHoliday] = useState(false);
  const [prediction, setPrediction] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function runScenario() {
    setLoading(true);
    try {
      const res = await fetch(`${ML_API_URL}/scenario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temp,
          hour,
          day_of_week: dayOfWeek,
          is_holiday: isHoliday,
        }),
      });
      const data = await res.json();
      setPrediction(data.prediction);
    } catch {
      // Demo modu: gerçekçi hesaplama
      // Saat etkisi: gündüz yüksek (10-18 arası pik), gece düşük
      const hourFactor = -Math.cos((hour / 24) * Math.PI * 2) * 5000;
      const base = 30000 + hourFactor;

      // Sıcaklık etkisi: aşırı sıcak (+35) ve aşırı soğuk (-5) tüketimi artırır
      // Optimal 18-22 derece arası en düşük tüketim (ne klima ne kalorifer)
      const optimalTemp = 20;
      const tempDeviation = Math.abs(temp - optimalTemp);
      const tempFactor = tempDeviation * 150; // her derece sapma +150 MWh

      // Tatil/hafta sonu azaltır (fabrikalar kapalı)
      const holidayFactor = isHoliday ? -4000 : 0;
      const weekendFactor = dayOfWeek >= 5 ? -2500 : 0;

      setPrediction(Math.round(base + tempFactor + holidayFactor + weekendFactor));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card data-onboarding="scenario">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          Senaryo Analizi
          <InfoTooltip text="Sıcaklık, saat, gün ve tatil parametrelerini değiştirerek enerji tüketim tahmini yapabilirsiniz. Aşırı sıcak/soğuk havalarda klima/kalorifer kullanımı tüketimi artırır. İş saatlerinde (10-18) tüketim en yüksek seviyededir." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:space-y-5 sm:px-6">
        <Slider
          label="Sıcaklık (°C)"
          min={-10}
          max={45}
          step={1}
          value={temp}
          onChange={setTemp}
        />

        <Slider
          label="Saat"
          min={0}
          max={23}
          step={1}
          value={hour}
          onChange={setHour}
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Haftanın Günü</span>
          <Select
            options={DAY_OPTIONS}
            value={String(dayOfWeek)}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
          />
        </div>

        <Switch
          label="Resmî Tatil"
          checked={isHoliday}
          onCheckedChange={setIsHoliday}
        />

        <Button onClick={runScenario} disabled={loading} className="w-full">
          {loading ? "Hesaplanıyor..." : "Tahmin Yap"}
        </Button>

        {prediction !== null && (
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <div className="text-xs text-muted-foreground sm:text-sm">Tahmini Tüketim</div>
            <div className="text-2xl font-bold text-primary sm:text-3xl">
              {prediction.toLocaleString("tr-TR")} <span className="text-base font-normal sm:text-lg">MWh</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
