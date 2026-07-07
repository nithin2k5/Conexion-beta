import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conexion — Talk to Strangers Instantly",
  description: "Connect anonymously with random people via text or video chat. No sign-up required.",
  keywords: ["random chat", "video chat", "text chat", "strangers", "conexion", "anonymous"],
  openGraph: {
    title: "Conexion — Talk to Strangers Instantly",
    description: "Connect anonymously with random people via text or video chat.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased min-h-screen flex flex-col font-sans relative overflow-x-hidden"
        style={{ backgroundColor: "var(--color-ivory)", color: "var(--color-charcoal)" }}>
        <div className="relative z-10 flex flex-col flex-1">
          {children}
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
