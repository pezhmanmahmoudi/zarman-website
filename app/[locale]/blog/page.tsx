import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, ChevronRight, ChevronLeft } from "lucide-react";
import styles from "@/styles/Blog.module.css";
import { blogPosts } from "@/data/blog-posts";

const PRODUCTION_URL = "https://zarman.com.au";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === "en";

  return {
    title: isEn
      ? "Blog | AUD/IRT Exchange Rate Guides & Remittance Tips"
      : "مقالات | راهنمای نرخ ارز و حواله از استرالیا",
    description: isEn
      ? "Expert guides on AUD to IRT exchange rates, how to send money from Australia to Iran, AUSTRAC compliance, and getting the best remittance rate."
      : "راهنماهای تخصصی درباره نرخ دلار استرالیا به تومان، ارسال حواله از استرالیا به ایران، قوانین AUSTRAC، و دریافت بهترین نرخ صرافی.",
    alternates: {
      canonical: `${PRODUCTION_URL}/${locale}/blog`,
      languages: {
        en: `${PRODUCTION_URL}/en/blog`,
        fa: `${PRODUCTION_URL}/fa/blog`,
        "x-default": `${PRODUCTION_URL}/en/blog`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const isEn = locale === "en";
  const BackIcon = isEn ? ArrowLeft : ArrowRight;
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
      ? "Zarman Exchange Blog — AUD/IRT Guides &amp; Remittance Tips"
      : "مقالات صرافی زرمان — راهنمای نرخ ارز و حواله",
    description: isEn
      ? "Expert guides on AUD to IRT exchange rates and Australia to Iran remittance."
      : "راهنماهای تخصصی درباره نرخ دلار استرالیا و حواله به ایران.",
    url: `${PRODUCTION_URL}/${locale}/blog`,
    inLanguage: isEn ? "en-AU" : "fa-IR",
    publisher: { "@id": `${PRODUCTION_URL}/#organization` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <section className={styles.section} aria-labelledby="blog-heading">
        <div className={styles.bgGrid} aria-hidden="true" />
        <div className={styles.bgGlow} aria-hidden="true" />

        <div className={styles.container}>
          <nav className={styles.topNav} aria-label={isEn ? "Back to home" : "بازگشت"}>
            <Link href={`/${locale}`} className={styles.backHome}>
              <BackIcon size={16} strokeWidth={2.5} />
              {isEn ? "Back to home" : "بازگشت به خانه"}
            </Link>
          </nav>

          <header className={styles.header}>
            <span className={styles.eyebrow}>
              {isEn ? "Insights & Guides" : "راهنماها و تحلیل‌ها"}
            </span>
            <h1 id="blog-heading" className={styles.title}>
              {isEn ? "Zarman Blog" : "مقالات زرمان"}
            </h1>
            <p className={styles.subtitle}>
              {isEn
                ? "Expert guides on AUD/IRT exchange rates, remittance compliance, and getting the best rate for your Australia-to-Iran transfers."
                : "راهنماهای تخصصی درباره نرخ دلار استرالیا، قوانین حواله، و دریافت بهترین نرخ برای انتقال پول از استرالیا به ایران."}
            </p>
          </header>

          {posts.length === 0 ? (
            <p className={styles.empty}>
              {isEn ? "No articles yet. Check back soon." : "هنوز مقاله‌ای منتشر نشده. به زودی برگردید."}
            </p>
          ) : (
            <div className={styles.grid}>
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/${locale}/blog/${post.slug}`}
                  className={styles.card}
                  aria-label={post.title}
                >
                  <span className={styles.categoryBadge}>{post.categoryLabel}</span>
                  <h2 className={styles.cardTitle}>{post.title}</h2>
                  <p className={styles.cardDescription}>{post.description}</p>
                  <div className={styles.cardMeta}>
                    <Clock size={13} strokeWidth={2} />
                    <span>
                      {isEn
                        ? `${post.readingTime} min read`
                        : `${post.readingTime} دقیقه مطالعه`}
                    </span>
                    <span className={styles.metaDot} />
                    <span>
                      {new Date(post.publishedAt).toLocaleDateString(
                        isEn ? "en-AU" : "fa-IR",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </span>
                  </div>
                  <span className={styles.readMore} aria-hidden="true">
                    {isEn ? "Read article" : "مطالعه مقاله"}
                    <ReadMoreIcon size={15} strokeWidth={2.5} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
