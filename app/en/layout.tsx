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
      fa: "/",
      en: "/en/",
      "x-default": "/",
    },
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}