import type { Metadata } from "next";
import Link from "next/link";
import ContentNavigation from "@/components/layout/ContentNavigation";
import { CalendarDays, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import styles from "@/styles/Blog.module.css";
import { blogPosts } from "@/data/blog-posts";

import { SITE_URL as PRODUCTION_URL, getPageMetadata, organizationId, websiteId, serializeJsonLd } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";
  return getPageMetadata({
    locale,
    path: "/blog",
    title: isEn ? "AUD to Toman & Australia–Iran Transfer Guides" : "راهنمای نرخ دلار استرالیا و حواله به ایران",
    description: isEn ? "Read practical guides to AUD to toman rates, comparing transfer quotes, identity verification and sending money from Australia to Iran." : "راهنمای نرخ دلار استرالیا به تومان، مقایسه هزینه حواله، احراز هویت و مراحل انتقال پول از استرالیا به ایران را در مقالات زرمان بخوانید.",
  });
}

export default async function BlogListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const ReadMoreIcon = isEn ? ChevronRight : ChevronLeft;

  const posts = blogPosts.filter((p) => p.locale === locale);

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
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${PRODUCTION_URL}/${locale}/blog`,
    name: isEn
      ? "Zarman Exchange Blog — AUD to Toman & Remittance Guides"
      : "مقالات صرافی زرمان — راهنمای نرخ ارز و حواله",
    description: isEn
      ? "Practical guides to AUD to toman exchange rates and Australia to Iran remittance."
      : "راهنمای نرخ دلار استرالیا، مقایسه هزینه حواله و مراحل انتقال پول به ایران.",
    url: `${PRODUCTION_URL}/${locale}/blog`,
    inLanguage: isEn ? "en-AU" : "fa",
    publisher: { "@id": organizationId },
    isPartOf: { "@id": websiteId },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: post.title,
        url: `${PRODUCTION_URL}/${locale}/blog/${post.slug}`,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(collectionSchema) }}
      />

      <section className={styles.section} aria-labelledby="blog-heading">
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.container}>
          <ContentNavigation locale={locale} currentPath="/blog" />

          <header className={styles.header}>
            <div className={styles.headingGroup}>
              <span className={styles.eyebrow}>
                {isEn ? "Zarman knowledge desk" : "مرکز دانش زرمان"}
              </span>
              <h1 id="blog-heading" className={styles.title}>
                {isEn ? "Clear guidance for every transfer" : "راهنمای روشن برای هر حواله"}
              </h1>
            </div>
            <p className={styles.subtitle}>
              {isEn
                ? "Practical, source-led guides to AUD and toman quotes, transfer costs, identity checks and sending money between Australia and Iran."
                : "راهنماهای کاربردی و مستند درباره نرخ دلار استرالیا و تومان، هزینه حواله، احراز هویت و انتقال پول میان استرالیا و ایران."}
            </p>
          </header>

          {posts.length === 0 ? (
            <p className={styles.empty}>
              {isEn ? "No articles yet. Check back soon." : "هنوز مقاله‌ای منتشر نشده. به زودی برگردید."}
            </p>
          ) : (
            <div className={styles.collection}>
              <div className={styles.collectionHeader}>
                <h2>{isEn ? "Latest guides" : "جدیدترین راهنماها"}</h2>
                <span>{isEn ? `${posts.length} articles` : `${posts.length.toLocaleString("fa-IR")} مقاله`}</span>
              </div>
              <div className={styles.grid}>
                {posts.map((post, index) => (
                  <article key={post.slug} className={styles.card} data-category={post.category}>
                    <Link
                      href={`/${locale}/blog/${post.slug}`}
                      className={styles.cardLink}
                      aria-label={post.title}
                    >
                      <div className={styles.cardTopline}>
                        <span className={styles.categoryBadge}>{post.categoryLabel}</span>
                        <span className={styles.cardNumber} aria-hidden="true">
                          {(index + 1).toLocaleString(isEn ? "en-AU" : "fa-IR", { minimumIntegerDigits: 2 })}
                        </span>
                      </div>
                      <h3 className={styles.cardTitle}>{post.title}</h3>
                      <p className={styles.cardDescription}>{post.description}</p>
                      <div className={styles.cardFooter}>
                        <div className={styles.cardMeta}>
                          <span className={styles.metaItem}>
                            <CalendarDays size={14} strokeWidth={2} />
                            {new Date(post.publishedAt).toLocaleDateString(
                              isEn ? "en-AU" : "fa-IR",
                              { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }
                            )}
                          </span>
                          <span className={styles.metaItem}>
                            <Clock size={14} strokeWidth={2} />
                            {isEn
                              ? `${post.readingTime} min`
                              : `${post.readingTime.toLocaleString("fa-IR")} دقیقه`}
                          </span>
                        </div>
                        <span className={styles.readMore} aria-hidden="true">
                          {isEn ? "Read guide" : "مطالعه راهنما"}
                          <span className={styles.readMoreIcon}>
                            <ReadMoreIcon size={16} strokeWidth={2.5} />
                          </span>
                        </span>
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
