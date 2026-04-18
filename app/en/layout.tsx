import type { Metadata, ReactNode } from "next";
import EnglishPageWrapper from "@/components/layout/PageWrapper/EnglishPageWrapper";

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
    languages: {
      fa: "https://zarman.com.au",
      en: "https://zarman.com.au/en/",
      "x-default": "https://zarman.com.au",
    },
  },
};

export default function EnLayout({ children }: { children: ReactNode }) {
  return <EnglishPageWrapper>{children}</EnglishPageWrapper>;
}