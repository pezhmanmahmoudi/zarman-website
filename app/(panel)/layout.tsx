import localFont from "next/font/local";
import "@/app/globals.css";

const inter = localFont({
  src: [
    { path: "../../public/fonts/Inter-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Inter-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/Inter-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-en",
  display: "swap",
});

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
