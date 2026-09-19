import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

const bodyFont = localFont({ src: [{ path: "../public/fonts/dm-sans-regular.ttf", weight: "400", style: "normal" }, { path: "../public/fonts/dm-sans-semibold.ttf", weight: "600", style: "normal" }], variable: "--font-body", display: "swap" });
const displayFont = localFont({ src: [{ path: "../public/fonts/fraunces.ttf", weight: "500", style: "normal" }, { path: "../public/fonts/fraunces-italic.ttf", weight: "500", style: "italic" }], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "FoodFinder — A little curiosity. A better basket.",
  description: "Explore your everyday foods, discover product details in four languages, and look closer with premium nutrition.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
