import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vikche",
  description: "Проследявай цените на продуктите, които искаш!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" className="h-full antialiased">
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
