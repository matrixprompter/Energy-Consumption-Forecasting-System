"use client";

import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingButton } from "@/components/OnboardingButton";
import { Zap } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              <h1 className="text-sm font-bold sm:text-lg">Enerji Tahmin Dashboard</h1>
            </div>
            <div className="flex items-center gap-1">
              <OnboardingButton />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t py-4 text-center text-xs text-muted-foreground sm:text-sm">
          Prophet &middot; XGBoost &middot; SARIMA — Enerji Tahmin Sistemi
        </footer>
      </div>
    </ThemeProvider>
  );
}
