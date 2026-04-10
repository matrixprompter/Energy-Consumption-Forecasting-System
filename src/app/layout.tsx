import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enerji Tahmin Dashboard",
  description: "Prophet, XGBoost ve SARIMA ile saatlik enerji tüketim tahmini",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
