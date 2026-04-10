"use client";

import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { Activity, Clock, Target, Trophy } from "lucide-react";

interface KPICardsProps {
  avgConsumption: number;
  peakHour: number;
  bestAccuracy: number;
  bestModel: string;
}

export function KPICards({ avgConsumption, peakHour, bestAccuracy, bestModel }: KPICardsProps) {
  const cards = [
    {
      title: "Ort. Tüketim",
      value: `${(avgConsumption / 1000).toFixed(1)}k MWh`,
      icon: Activity,
      color: "text-blue-500",
      tooltip: "Seçilen dönem içindeki ortalama saatlik enerji tüketimini gösterir. Değer MWh (Megawatt-saat) cinsindendir.",
    },
    {
      title: "Pik Saati",
      value: `${String(peakHour).padStart(2, "0")}:00`,
      icon: Clock,
      color: "text-orange-500",
      tooltip: "Gün içerisinde en yüksek enerji tüketiminin yaşandığı saati gösterir. Genellikle iş saatlerinde (10:00-18:00) pik yapılır.",
    },
    {
      title: "En İyi Doğruluk",
      value: `${(100 - bestAccuracy).toFixed(1)}%`,
      subtitle: `MAPE: ${bestAccuracy.toFixed(1)}%`,
      icon: Target,
      color: "text-green-500",
      tooltip: "En düşük MAPE (Ortalama Mutlak Yüzde Hata) değerine sahip modelin doğruluk oranı. MAPE ne kadar düşükse tahmin o kadar başarılıdır.",
    },
    {
      title: "En İyi Model",
      value: bestModel.toUpperCase(),
      icon: Trophy,
      color: "text-purple-500",
      tooltip: "MAPE metriğine göre en başarılı tahmin modeli. Prophet, XGBoost ve SARIMA modelleri arasında karşılaştırma yapılır.",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-onboarding="kpi-cards">
      {cards.map((card) => (
        <Card key={card.title} className="overflow-visible">
          <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-6">
            <div className={`shrink-0 rounded-lg bg-muted p-2 sm:p-3 ${card.color}`}>
              <card.icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                <span className="truncate">{card.title}</span>
                <InfoTooltip text={card.tooltip} />
              </p>
              <p className="text-lg font-bold sm:text-2xl">{card.value}</p>
              {card.subtitle && (
                <p className="text-[10px] text-muted-foreground sm:text-xs">{card.subtitle}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
