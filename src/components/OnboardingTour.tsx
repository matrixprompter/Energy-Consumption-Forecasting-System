"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const ONBOARDING_KEY = "energy-dashboard-onboarding-seen";

export const TOUR_EVENT = "start-onboarding-tour";

interface TourStep {
  target: string; // data-onboarding value
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    target: "kpi-cards",
    title: "KPI Kartları",
    description:
      "Ortalama tüketim, pik saati, en iyi model doğruluğu ve kazanan model gibi önemli metrikleri tek bakışta görebilirsiniz.",
  },
  {
    target: "forecast-chart",
    title: "Enerji Tüketim Tahmini",
    description:
      "Mavi çizgi gerçek tüketimi, turuncu kesikli çizgi model tahminini gösterir. Açık mavi alan %95 güven aralığıdır. Fare tekerleğiyle yakınlaştırın, sürükleyerek kaydırın.",
  },
  {
    target: "model-comparison",
    title: "Model Karşılaştırma",
    description:
      "Prophet ve XGBoost modellerinin MAPE, RMSE, MAE ve R² skorlarını karşılaştırır. Yeşil çubuk her metrikte en iyi modeli vurgular.",
  },
  {
    target: "feature-importance",
    title: "Özellik Önemi (SHAP)",
    description:
      "XGBoost modelinin hangi değişkenlere (sıcaklık, saat, geçmiş tüketim vb.) ne kadar önem verdiğini SHAP analizi ile görebilirsiniz.",
  },
  {
    target: "heatmap",
    title: "Isı Haritası",
    description:
      "Haftanın 7 günü × 24 saat tüketim dağılımı. Koyu mavi = yüksek tüketim. Kırmızı çerçeve pik noktasını gösterir.",
  },
  {
    target: "scenario",
    title: "Senaryo Analizi",
    description:
      "Sıcaklık, saat, gün ve tatil parametrelerini değiştirerek \"ya şöyle olsaydı?\" senaryoları oluşturun. Aşırı hava koşullarında tüketim artışını gözlemleyin.",
  },
  {
    target: "export",
    title: "Rapor Aktar",
    description:
      "Tüm tahmin ve metrikleri PDF rapor, Excel veya CSV olarak indirin. PDF'de model karşılaştırma tablosu ve saatlik veriler yer alır.",
  },
  {
    target: "forecast-table",
    title: "Tahmin Veri Tablosu",
    description:
      "Her saat için gerçek ve tahmin değerlerini detaylı görün. Hata renkleri: yeşil <%5 (iyi), sarı %5-10 (orta), kırmızı >%10 (düşük).",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  const startTour = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  // Auto-start for first-time users
  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_KEY);
    if (!seen) {
      // Small delay so cards render first
      const t = setTimeout(() => startTour(), 800);
      return () => clearTimeout(t);
    }
  }, [startTour]);

  // Listen for manual re-trigger from header button
  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener(TOUR_EVENT, handler);
    return () => window.removeEventListener(TOUR_EVENT, handler);
  }, [startTour]);

  // Track target element position
  useEffect(() => {
    if (!active) return;

    function updateRect() {
      const el = document.querySelector(`[data-onboarding="${STEPS[step].target}"]`);
      if (!el) {
        setTargetRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
    }

    // Scroll to target
    const el = document.querySelector(`[data-onboarding="${STEPS[step].target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Wait for scroll to finish then measure
      setTimeout(updateRect, 400);
    }

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, step]);

  function close() {
    setActive(false);
    localStorage.setItem(ONBOARDING_KEY, "true");
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!active || !targetRect) return null;

  const current = STEPS[step];
  const pad = 8;

  // Tooltip position: prefer below the card, fallback above if not enough space
  const viewH = window.innerHeight;
  const cardBottomOnScreen = targetRect.top - window.scrollY + targetRect.height + pad;
  const showBelow = cardBottomOnScreen + 220 < viewH;

  const tooltipTop = showBelow
    ? targetRect.top + targetRect.height + pad + 8
    : targetRect.top - pad - 8;

  // Keep tooltip horizontally centered on card but within viewport
  const tooltipWidth = Math.min(360, window.innerWidth - 32);
  let tooltipLeft = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
  tooltipLeft = Math.max(16, Math.min(tooltipLeft, window.innerWidth - tooltipWidth - 16));

  return createPortal(
    <div className="onboarding-tour" style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      {/* Dark overlay with cutout */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "auto" }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={targetRect.left - pad + window.scrollX - window.scrollX}
              y={targetRect.top - pad - window.scrollY}
              width={targetRect.width + pad * 2}
              height={targetRect.height + pad * 2}
              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Blue highlight ring around card */}
      <div
        style={{
          position: "fixed",
          top: targetRect.top - pad - window.scrollY,
          left: targetRect.left - pad,
          width: targetRect.width + pad * 2,
          height: targetRect.height + pad * 2,
          borderRadius: 12,
          border: "3px solid rgb(59, 130, 246)",
          boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.25), 0 0 20px rgba(59, 130, 246, 0.15)",
          pointerEvents: "none",
          transition: "all 0.3s ease",
        }}
      />

      {/* Tooltip card */}
      <div
        style={{
          position: "fixed",
          top: showBelow
            ? cardBottomOnScreen + 8
            : targetRect.top - pad - window.scrollY - 8,
          left: tooltipLeft,
          width: tooltipWidth,
          transform: showBelow ? "none" : "translateY(-100%)",
          pointerEvents: "auto",
          zIndex: 10000,
        }}
        className="rounded-xl border bg-background p-4 shadow-2xl sm:p-5"
      >
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-primary">
              Adım {step + 1} / {STEPS.length}
            </div>
            <h3 className="text-sm font-bold sm:text-base">{current.title}</h3>
          </div>
          <button
            onClick={close}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Description */}
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {current.description}
        </p>

        {/* Progress dots */}
        <div className="mb-3 flex justify-center gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/25"
              }`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Geri
          </Button>

          <button
            onClick={close}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Atla
          </button>

          <Button size="sm" onClick={next} className="gap-1 text-xs">
            {step === STEPS.length - 1 ? "Bitir" : "İleri"}
            {step < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
