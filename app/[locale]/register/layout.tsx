import type { Metadata } from "next";

const PRODUCTION_URL = "https://zarman.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  const title = isEn
    ? "Register | Zarman Exchange"
    : "ثبت نام | صرافی زرمان";

  const description = isEn
    ? "Create your Zarman account to access personalized AUD/IRT rates, secure transfers, and real-time request tracking."
    : "با ایجاد حساب کاربری در زرمان، به نرخ شخصی سازی شده AUD/IRT، انتقال امن و پیگیری لحظه ای درخواست ها دسترسی داشته باشید.";

  return {
    title,
    description,
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/register`,
      languages: {
        "en-AU": `${PRODUCTION_URL}/en/register`,
        "fa-IR": `${PRODUCTION_URL}/fa/register`,
        "x-default": `${PRODUCTION_URL}/fa/register`,
      },
    },
    openGraph: {
      title,
      description,
      url: `${PRODUCTION_URL}/${locale}/register`,
      type: "website",
      images: [{ url: `${PRODUCTION_URL}/images/layout-logo.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${PRODUCTION_URL}/images/layout-logo.png`],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
