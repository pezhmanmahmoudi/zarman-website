import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import ContentNavigation from "@/components/layout/ContentNavigation";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, Clock, ExternalLink } from "lucide-react";
import articleStyles from "@/styles/BlogArticle.module.css";
import { blogPosts, getBlogAlternatePaths } from "@/data/blog-posts";
import { SITE_URL as PRODUCTION_URL, getPageMetadata, organizationId, serializeJsonLd } from "@/lib/seo";

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
  if (!post) notFound();

  return {
    ...getPageMetadata({
      locale,
      path: `/blog/${slug}`,
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      alternatePaths: getBlogAlternatePaths(post),
    }),
    authors: [{ name: "Zarman Exchange", url: `${PRODUCTION_URL}/${locale}/about` }],
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isEn = locale === "en";
  const ActionIcon = isEn ? ArrowRight : ArrowLeft;

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
    dateModified: post.updatedAt ?? post.publishedAt,
    inLanguage: isEn ? "en-AU" : "fa",
    mainEntityOfPage: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
    citation: post.sources.map((source) => source.url),
    url: `${PRODUCTION_URL}/${locale}/blog/${slug}`,
    author: {
      "@type": "Organization",
      name: "Zarman Exchange",
      "@id": organizationId,
      url: `${PRODUCTION_URL}/${locale}/about`,
    },
    publisher: {
      "@id": organizationId,
    },
    isPartOf: {
      "@type": "CollectionPage",
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
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
  );
  const formattedUpdatedDate = post.updatedAt
    ? new Date(post.updatedAt).toLocaleDateString(
      isEn ? "en-AU" : "fa-IR",
      { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
    )
    : null;
  const formattedReadingTime = post.readingTime.toLocaleString(isEn ? "en-AU" : "fa-IR");

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleSchema) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />

      <div className={articleStyles.pageWrapper}>
        <div className={articleStyles.backgroundGrid} aria-hidden="true" />
        <div className={articleStyles.shell}>
          <ContentNavigation locale={locale} currentPath={`/blog/${slug}`} />

          <article className={articleStyles.article}>
            <header className={articleStyles.articleHeader}>
              <div className={articleStyles.brandLine}>
                <Image
                  src="/images/logo-no-text-light.svg"
                  alt=""
                  width={48}
                  height={48}
                  className={articleStyles.logoImage}
                />
                <div>
                  <span>{isEn ? "Zarman knowledge desk" : "مرکز دانش زرمان"}</span>
                  <small>{isEn ? "Practical transfer guidance" : "راهنمای کاربردی حواله"}</small>
                </div>
              </div>

              <span className={articleStyles.categoryBadge}>{post.categoryLabel}</span>
              <h1 className={articleStyles.articleTitle}>{post.title}</h1>
              <p className={articleStyles.articleSummary}>{post.description}</p>

              <div className={articleStyles.bylineRow}>
                <Link href={`/${locale}/about`} className={articleStyles.authorLink}>
                  <span className={articleStyles.authorIcon} aria-hidden="true">
                    <Building2 size={18} strokeWidth={2} />
                  </span>
                  <span>
                    <small>{isEn ? "Written by" : "نویسنده"}</small>
                    <strong>{isEn ? "Zarman Exchange" : "صرافی زرمان"}</strong>
                  </span>
                </Link>
                <div className={articleStyles.articleMeta}>
                  <span className={articleStyles.metaItem}>
                    <CalendarDays size={15} strokeWidth={2} />
                    <time dateTime={post.publishedAt}>{formattedDate}</time>
                  </span>
                  <span className={articleStyles.metaItem}>
                    <Clock size={15} strokeWidth={2} />
                    {isEn ? `${formattedReadingTime} min read` : `${formattedReadingTime} دقیقه مطالعه`}
                  </span>
                </div>
              </div>
            </header>

            <div className={articleStyles.bodyLayout}>
              <aside className={articleStyles.articleRail} aria-label={isEn ? "Article details" : "مشخصات مقاله"}>
                <span className={articleStyles.railHeading}>{isEn ? "Article details" : "مشخصات مقاله"}</span>
                <dl>
                  <div>
                    <dt>{isEn ? "Topic" : "موضوع"}</dt>
                    <dd>{post.categoryLabel}</dd>
                  </div>
                  <div>
                    <dt>{isEn ? "Published" : "انتشار"}</dt>
                    <dd><time dateTime={post.publishedAt}>{formattedDate}</time></dd>
                  </div>
                  {formattedUpdatedDate && (
                    <div>
                      <dt>{isEn ? "Last reviewed" : "آخرین بازبینی"}</dt>
                      <dd><time dateTime={post.updatedAt}>{formattedUpdatedDate}</time></dd>
                    </div>
                  )}
                  <div>
                    <dt>{isEn ? "Reading time" : "زمان مطالعه"}</dt>
                    <dd>{isEn ? `${formattedReadingTime} minutes` : `${formattedReadingTime} دقیقه`}</dd>
                  </div>
                </dl>
                <Link href={`/${locale}/about`} className={articleStyles.railLink}>
                  {isEn ? "About Zarman" : "درباره زرمان"}
                  <ActionIcon size={15} strokeWidth={2.5} />
                </Link>
              </aside>

              <div className={articleStyles.readingColumn}>
                <div
                  className={articleStyles.articleContent}
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />

                <section className={articleStyles.sourcesSection} aria-labelledby="article-sources">
                  <span className={articleStyles.sectionLabel}>{isEn ? "Reference desk" : "مراجع مقاله"}</span>
                  <h2 id="article-sources">{isEn ? "Sources and further reading" : "منابع و مطالعه بیشتر"}</h2>
                  <ul className={articleStyles.sourceList}>
                    {post.sources.map((source) => (
                      <li key={source.url}>
                        <a href={source.url}>
                          <span>{source.title}</span>
                          <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className={articleStyles.disclaimer}>{isEn
                    ? "This guide provides general information. Transfer availability, required documents, rates and timing depend on the transaction and current requirements. Confirm the details of your transfer before sending funds."
                    : "این راهنما اطلاعات عمومی ارائه می‌کند. امکان انجام حواله، مدارک موردنیاز، نرخ و زمان تسویه به تراکنش و الزامات جاری بستگی دارد. پیش از واریز وجه، جزئیات حواله خود را تأیید کنید."}</p>
                </section>

                <nav className={articleStyles.relatedSection} aria-label={isEn ? "Related guides" : "راهنماهای مرتبط"}>
                  <span className={articleStyles.sectionLabel}>{isEn ? "Continue reading" : "ادامه مطالعه"}</span>
                  <h2>{isEn ? "Related guides" : "راهنماهای مرتبط"}</h2>
                  <div className={articleStyles.relatedList}>
                    {blogPosts.filter((related) => related.locale === locale && related.slug !== slug).map((related) => (
                      <Link key={related.slug} href={`/${locale}/blog/${related.slug}`}>
                        <span>
                          <small>{related.categoryLabel}</small>
                          <strong>{related.title}</strong>
                        </span>
                        <ActionIcon size={18} strokeWidth={2.5} aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                  <Link href={`/${locale}/services`} className={articleStyles.servicesLink}>
                    {isEn ? "Explore our remittance services" : "خدمات حواله زرمان را ببینید"}
                    <ActionIcon size={16} strokeWidth={2.5} />
                  </Link>
                </nav>
              </div>
            </div>

            <footer className={articleStyles.articleFooter}>
              <div className={articleStyles.ctaBox}>
                <div className={articleStyles.ctaCopy}>
                  <span>{isEn ? "Your next step" : "گام بعدی شما"}</span>
                  <p>
                    {isEn
                      ? "Review a personalised AUD/IRT quote for your transfer."
                      : "نرخ شخصی‌سازی‌شده AUD/IRT را برای حواله خود بررسی کنید."}
                  </p>
                </div>
                <Link href={`/${locale}/register`} className={articleStyles.ctaButton}>
                  {isEn ? "Request your rate" : "درخواست نرخ شخصی"}
                  <ActionIcon size={18} strokeWidth={2.5} />
                </Link>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </>
  );
}
