"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  text: string;
  className?: string;
}

export function InfoTooltip({ text, className }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const iconRef = useRef<HTMLSpanElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMounted(true), []);

  const open = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setShow(true);
  }, []);

  const close = useCallback(() => {
    hideTimer.current = setTimeout(() => setShow(false), 120);
  }, []);

  useEffect(() => {
    if (!show || !iconRef.current) return;

    const rect = iconRef.current.getBoundingClientRect();
    const tooltipW = 260;
    const tooltipH = 80;

    let left = rect.left + rect.width / 2 - tooltipW / 2;
    if (left < 8) left = 8;
    if (left + tooltipW > window.innerWidth - 8) left = window.innerWidth - tooltipW - 8;

    const spaceAbove = rect.top;
    if (spaceAbove > tooltipH + 16) {
      setStyle({ position: "fixed", top: rect.top - 8, left, transform: "translateY(-100%)" });
    } else {
      setStyle({ position: "fixed", top: rect.bottom + 8, left });
    }
  }, [show]);

  return (
    <span
      ref={iconRef}
      className={cn("relative inline-flex shrink-0", className)}
      onMouseEnter={open}
      onMouseLeave={close}
      onClick={() => setShow((s) => !s)}
    >
      <Info className="h-4 w-4 cursor-help text-muted-foreground transition-colors hover:text-primary" />
      {show &&
        mounted &&
        createPortal(
          <div
            className="z-[9999] w-[260px] rounded-lg border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-lg"
            style={style}
            onMouseEnter={open}
            onMouseLeave={close}
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}
