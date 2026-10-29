import type { Metadata, Viewport } from "next";
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

const DESCRIPTION =
  "South Carolina Gamecocks football, basketball and baseball: live scores, schedules, results and game alerts.";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gamecock.ai"),
  title: "Gamecock AI",
  description: DESCRIPTION,
  applicationName: "Gamecock AI",
  icons: {
    icon: [
      { url: "/gamecock.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Gamecocks",
    statusBarStyle: "black-translucent",
  },
  // Next emits only mobile-web-app-capable; older iOS still keys off the apple- prefix.
  other: { "apple-mobile-web-app-capable": "yes" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Gamecock AI",
    description: DESCRIPTION,
    url: "https://www.gamecock.ai",
    siteName: "Gamecock AI",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Gamecock AI",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
