import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import themeStyles from "@/styles/admin/AdminTheme.module.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

// viewport-fit=cover exposes env(safe-area-inset-*) so admin chrome can clear
// notches and the home indicator on mobile.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function PanelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: mobile Chrome injects its own __gchrome_* attributes before hydration.
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${inter.variable} ${themeStyles.theme} min-h-screen antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
