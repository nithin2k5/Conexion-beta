import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conexion — Meet Strangers Instantly",
  description: "Connect with random people around the world via text chat. Secure, anonymous, and real-time.",
  keywords: ["random chat", "text chat", "strangers", "conexion"],
  openGraph: {
    title: "Conexion — Meet Strangers Instantly",
    description: "Connect with random people around the world via text chat.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" style={{ height: "100%" }} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
        {children}
      </body>
    </html>
  );
}
