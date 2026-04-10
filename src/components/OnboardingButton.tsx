"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOUR_EVENT } from "@/components/OnboardingTour";

export function OnboardingButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent(TOUR_EVENT));
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label="Rehber turu başlat"
      title="Rehber turu başlat"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
