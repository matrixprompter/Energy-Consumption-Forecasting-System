"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow((s) => !s)}
    >
      <Info className="h-4 w-4 cursor-help text-muted-foreground transition-colors hover:text-primary" />
      {show && (
        <span className="absolute bottom-full left-1/2 z-[100] mb-2 w-56 -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg sm:w-64">
          {text}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-popover" />
        </span>
      )}
    </span>
  );
}
