import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zarman Exchange",
  description: "انتقال پول بین استرالیا و ایران ( AUD ↔ IRR )",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-screen antialiased">
        {/* برای کارکرد skip link */}
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
