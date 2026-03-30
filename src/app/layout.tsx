import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const hughIsLife = localFont({
  src: "./fonts/HughIsLifePersonalUse-Italic.ttf",
  variable: "--font-vikche-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vikche",
  description: "Проследявай цените на продуктите, които искаш!",
};

export const viewport: Viewport = {
  themeColor: "#fff5fa",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" className={`h-full antialiased ${hughIsLife.variable}`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
