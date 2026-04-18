import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { RateProvider } from "@/context/RateContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zarman.io"),
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={`${inter.variable}`}>
      <head>
        {/* Preload critical fonts */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen antialiased bg-[#080B12] text-white">
        <RateProvider>
          <main id="main-content">
            {children}
          </main>
        </RateProvider>
      </body>
    </html>
  );
}