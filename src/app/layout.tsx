import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gamecock AI",
  description: "Live scores, schedules, and stats for USC Gamecocks basketball",
  openGraph: {
    title: "Gamecock AI",
    description: "Live scores, schedules, and stats for USC Gamecocks basketball",
    url: "https://www.gamecock.ai",
    siteName: "Gamecock AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gamecock AI",
    description: "Live scores, schedules, and stats for USC Gamecocks basketball",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
