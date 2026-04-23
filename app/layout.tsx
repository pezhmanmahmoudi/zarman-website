import "./globals.css";

export default function GlobalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // اینجا تگ‌های html و body را بدون lang و dir قرار می‌دهیم 
    // تا لایوت‌های زیرمجموعه (fa و en) خودشان آن را مدیریت کنند.
    <html>
      <body>{children}</body>
    </html>
  );
}