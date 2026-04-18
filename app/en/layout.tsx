import type { Metadata, ReactNode } from "next";

export const metadata: Metadata = {
  title: {
    default: "Zarman Exchange | Legal Documents",
    template: "%s | Zarman Exchange",
  },
  description: "Legal documentation and policies for Zarman Exchange",
  openGraph: {
    locale: "en_US",
  },
  alternates: {
    canonical: "/en/",
    languages: {
      en: "/en/",
      "x-default": "/en/", // 👈 تغییر یافت
    },
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}