import type { Metadata } from "next";
import type { ReactNode } from "react"; // 👈 این خط اضافه و اصلاح شد

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
      "x-default": "/en/",
    },
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}