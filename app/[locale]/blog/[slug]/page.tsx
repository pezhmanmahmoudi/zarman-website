import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, CalendarDays } from "lucide-react";
import styles from "@/styles/About.module.css";
import articleStyles from "@/styles/BlogArticle.module.css";
import { blogPosts } from "@/data/blog-posts";

const PRODUCTION_URL = "https://zarman.com.au";

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    locale: post.locale,
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = blogPosts.find((p) => p.locale === locale && p.slug === slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    authors: [{ name: "Zarman Exchange", url: PRODUCTION_URL }],
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      authors: ["Zarman Exchange"],
      section: post.categoryLabel,
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isEn = locale === "en";
  const BackIcon = isEn ? ArrowLeft : ArrowRight;

  const post = blogPosts.find((p) => p.locale === locale && p.slug === slug);
  if (!post) notFound();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${PRODUCTION_URL}/${locale}/blog/${slug}`,
    headline: post.title,
    description: post.description,
    keywords: post.keywords.join(", "),
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    inLanguage: isEn ? "en-AU" : "fa-IR",
    url: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
    author: {
      "@type": "Organization",
      name: "Zarman Exchange",
      "@id": `${PRODUCTION_URL}/#organization`,
    },
    publisher: {
      "@id": `${PRODUCTION_URL}/#organization`,
    },
    isPartOf: {
      "@type": "Blog",
      "@id": `${PRODUCTION_URL}/${locale}/blog`,
      name: isEn ? "Zarman Exchange Blog" : "مقالات زرمان",
    },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: isEn ? "Home" : "خانه",
        item: `${PRODUCTION_URL}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: isEn ? "Blog" : "مقالات",
        item: `${PRODUCTION_URL}/${locale}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.title,
        item: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
      },
    ],
  };

  const formattedDate = new Date(post.publishedAt).toLocaleDateString(
    isEn ? "en-AU" : "fa-IR",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className={styles.pageWrapper}>
        <article className={styles.container}>

          <div className={styles.topNav}>
            <Link
              href={`/${locale}/blog`}
              className={styles.backHome}
              aria-label={isEn ? "Back to blog" : "بازگشت به مقالات"}
            >
              <BackIcon size={18} strokeWidth={2.5} />
            </Link>
          </div>

          <div className={styles.logoContainer}>
            <Image
              src="/images/logo-no-text-light.svg"
              alt="Zarman Exchange"
              width={80}
              height={80}
              priority
              className={styles.logoImage}
            />
          </div>

          <header className={articleStyles.articleHeader}>
            <span className={articleStyles.categoryBadge}>{post.categoryLabel}</span>
            <h1 className={articleStyles.articleTitle}>{post.title}</h1>
            <div className={articleStyles.articleMeta}>
              <span className={articleStyles.metaItem}>
                <CalendarDays size={14} strokeWidth={2} />
                {formattedDate}
              </span>
              <span className={articleStyles.metaDot} />
              <span className={articleStyles.metaItem}>
                <Clock size={14} strokeWidth={2} />
                {isEn
                  ? `${post.readingTime} min read`
                  : `${post.readingTime} دقیقه مطالعه`}
              </span>
            </div>
          </header>

          <div
            className={`${styles.content} ${articleStyles.articleContent}`}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          <footer className={articleStyles.articleFooter}>
            <div className={articleStyles.ctaBox}>
              <p className={articleStyles.ctaText}>
                {isEn
                  ? "Ready to start your transfer? See your personalised AUD/IRT rate now."
                  : "آماده شروع حواله هستید؟ همین حالا نرخ شخصی‌سازی‌شده AUD/IRT خود را ببینید."}
              </p>
              <Link href={`/${locale}/register`} className={articleStyles.ctaButton}>
                {isEn ? "Get My Personalised Rate →" : "دریافت نرخ شخصی‌سازی‌شده ←"}
              </Link>
            </div>
          </footer>

        </article>
      </div>
    </>
  );
}
