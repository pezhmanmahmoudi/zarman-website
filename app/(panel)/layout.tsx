import { Inter } from "next/font/google";
import type { Metadata } from "next";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-en",
  display: "swap",
});

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
    <html lang="en" dir="ltr" data-scroll-behavior="smooth">
      <body className={`${inter.variable} min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
