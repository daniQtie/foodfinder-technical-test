import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FoodFinder",
  description: "Search packaged foods and explore trustworthy product details.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
