# Zarman SEO and GEO audit

Date: 8 September 2026. Scope: public production responses, the Next.js codebase, both language editions, rendered HTML and automated local production-build checks. GEO here means visibility and accurate citation in generative search and AI answers.

The main technical and content problems identified in this audit have been corrected in the working tree. These changes are not deployed. No ranking, indexing, traffic, citation or Core Web Vitals score is claimed: those require production rollout and measurements from the relevant platforms.

## Owner-approved visual and brand direction

The existing visual design, entrance effects and motion must be preserved during SEO work. The owner explicitly confirmed that speed is the brand differentiator and requested the original banner motif: **«از اولورو تا دماوند، تنها در چند ساعت…»**, with the English **“From Uluru to Damavand, in just a few hours…”**. This approved slogan has been restored; the owner reports that transfers take less than one hour. Do not replace this motif with generic pricing copy in future SEO edits.

Original fade, blur, slide and stagger effects, FAQ disclosure motion and testimonial carousel presentation have been restored. Scoped no-JavaScript fallbacks and reduced-motion support preserve readability without changing the normal animated design. This direction supersedes the earlier approach of removing opacity transitions.

After this restoration, the production build, TypeScript, scoped ESLint and all 2,315 SEO assertions passed again with zero crawl failures or warnings. Both original-language slogans were checked in the rendered homepage HTML. Visual browser QA remains unavailable as described below.

## Findings and implemented corrections

| Priority | Finding and evidence | Correction |
| --- | --- | --- |
| Critical | Public homepage shipped nine fabricated fallback testimonials and a preset 4.8 rating when the database was empty or unavailable. | Removed all fabricated reviews and ratings. Server-render up to nine approved reviews using the existing public anonymous/RLS access. Calculate the average only from displayed reviews; render no section if none are available. Preserve the original scrolling columns and card appearance; repeated visual tracks are hidden from assistive technology. No aggregate-rating schema was added. |
| High | Live non-www home, robots and sitemap responses return 307 redirects to www, while canonical URLs and sitemap entries named non-www. | One shared production URL, https://www.zarman.com.au, now feeds canonical, hreflang, Open Graph, structured data, sitemap and llms.txt. Hosting-level permanent hostname redirect remains a deployment task below. |
| High | Persian hreflang targeted fa-IR only, despite an Australian and international Persian-speaking audience. English and Persian articles have different slugs without reciprocal mapping. | Use generic fa for Persian, en plus en-AU for English, and Persian x-default when a Persian counterpart exists. Self-canonicals remain distinct for each translation. Article mapping explicitly connects actual translated slugs. Existing fa-IR date/number formatting and Open Graph fa_IR remain appropriate formatting conventions. |
| High | Header returned null before hydration, so initial HTML lacked the main navigation. Language controls depended on JavaScript navigation. | Initial HTML now contains responsive navigation and real language anchors. Home, about, services and guides are linked. Content templates also have a lightweight navigation/language bar. |
| High | Homepage FAQ schema and visible answers differed; collapsed answers were not present in initial HTML. | One bilingual data source powers eight visible native details disclosures per language and matching FAQ JSON-LD. Readers can open answers without JavaScript. |
| High | Every page inherited a homepage WebPage graph, including invented publication dates. Schema contained unsupported credential/license, social-account and best-rate assertions. | Shared Organization/WebSite entities have stable IDs; the homepage WebPage is emitted only on the homepage. Pages use their own Article, Service, AboutPage and breadcrumb information. Removed invented dates and unsupported entity fields. JSON-LD escapes less-than characters. |
| High | Page-level metadata overwrote inherited Open Graph images and left generic Twitter data. Some branded titles duplicated the brand. | Shared metadata builder returns complete page-specific canonical, alternates, OG and Twitter metadata and uses absolute titles. The existing social asset is verified as an actual 1200 x 630 PNG. |
| High | Public copy promised zero fees, fixed loyalty thresholds, guaranteed timing, blanket legality and no repeated KYC, conflicting with configurable pricing or authoritative guidance. | Corrected both languages across guides, service pages, about, FAQs and public promotional sections. Quotes and availability are explained without inventing pricing rules or settlement guarantees. Public financial/legal copy still needs business compliance sign-off. |
| High | Calculator reverse conversion hardcoded a 15 AUD fee instead of the configured fee. Decimal input stripped the separator, so 10.50 became 1050. | Both directions use the existing pricing helper; configuration updates recalculate immediately. Persian and Arabic digits, decimal marks and thousands separators are handled. Malformed decimals preserve the previous value. See converter regression tests. |
| Medium | Sitemap included Persian legal URLs that redirect, omitted the public privacy policy, and assigned build/current timestamps to content without reliable modification evidence. | Sitemap contains 26 canonical public URLs only. English legal pages are included; redirecting Persian legal routes are omitted. Article modification dates represent actual editorial changes. Unknown modification dates are omitted. Reciprocal language annotations are generated from the same translation mapping as metadata. |
| Medium | Robots blocked login/reset forms, preventing crawlers from reading their noindex tags. Bare dashboard/admin paths were not consistently covered. | Forms stay crawlable with noindex metadata and X-Robots-Tag. Dashboard, admin, API and token callback routes are excluded from crawling. Authentication still controls private access. Vercel non-production deployments receive noindex headers. |
| Medium | Locale redirects were temporary and lost campaign query parameters. | Permanent 308 locale redirects preserve queries. Persian legal routes use permanent redirects to existing English policies. Missing articles/services return real 404s with noindex and localized recovery links. |
| Medium | Semantic content needed a readable fallback when JavaScript was unavailable. | Preserve the original entrance animations, with scoped no-JavaScript visibility for CSS/Framer hidden states and reduced-motion support. Content remains in server-rendered HTML. Service globes mount near the viewport, with no duplicate active mobile/desktop canvases. |
| Medium | Articles lacked visible accountable authorship, reliable source lists and meaningful update dates. | Added visible organizational authorship, publication/update dates, related-page links and primary RBA/AUSTRAC/DFAT sources. Rewrote four localized guides for clear questions, direct answers and defensible claims. No invented expert biographies. |
| Medium | Footer discovery, phone/email links and localized brand links were incomplete. | Corrected home/section links, linked all service cards, added useful public content links, clickable phone/email and neutral registration wording. |
| Medium | Vercel telemetry endpoints could be caught by locale routing. | Excluded /_vercel/ from the locale proxy so first-party analytics/Speed Insights routes can work. Deployment must still enable those services. |
| Low | llms.txt emphasized unverified claims and English, with old hostname references. | Replaced it with a concise bilingual source directory using canonical URLs and clear quote/currency context. It is supplemental documentation, not a recognized ranking guarantee or a substitute for indexable HTML. |

## Persian audience and search intent

Persian content stays the default at /fa. English remains separately accessible at /en; there are no IP-based or browser-language redirects between existing language pages. Persian uses lang=fa and dir=rtl. Locale switching preserves shared homepage anchors, maps translated blog slugs and falls back to the translated article index if no article match is known.

The following query groups are a qualitative intent map, not measured search volumes. Use Search Console data to prioritize expansion and avoid making multiple pages compete for the same question.

| Intent | Natural Persian examples | Primary destination |
| --- | --- | --- |
| Brand and general service | صرافی زرمان، صرافی استرالیا، حواله دلار استرالیا | /fa |
| Rate and comparison | نرخ دلار استرالیا به تومان، قیمت دلار استرالیا امروز، کارمزد حواله | Homepage quote calculator and /fa/blog/rahnamaye-nerkh-aud-irt |
| Australia to Iran | انتقال پول از استرالیا به ایران، حواله به ایران | /fa/blog/havaleh-az-australia-be-iran |
| Student payments from Iran | پرداخت شهریه دانشگاه استرالیا، حواله دانشجویی، هزینه OSHC | /fa/services/student-remittance |
| Healthcare registration | پرداخت هزینه AMC، پرداخت AHPRA، هزینه آزمون OET | /fa/services/healthcare-professional-payments |
| Capital transfer | انتقال سرمایه به استرالیا، حواله وجه حاصل از فروش ملک | /fa/services/capital-and-asset-transfer |
| Business payments | پرداخت فاکتور تجاری استرالیا، حواله تجاری | /fa/services/business-payment-infrastructure |
| Trust and assistance | احراز هویت صرافی، اطلاعات شرکت زرمان، تماس با زرمان | /fa/about and the public policies |

Use standard Persian ی and ک and natural half-spaces in new editorial content. Accept Persian/Arabic/Latin numeric input without publishing duplicate pages for spelling variants. Do not produce doorway pages for every Australian city or invent physical branches. If a city has a real staffed location and a distinct service experience, publish verified location details only after business confirmation.

## GEO approach

The implemented work prioritizes content that can be retrieved and quoted accurately: server-rendered text, descriptive headings, direct answers, real source links, consistent business identity, truthful update dates and matching structured data. Public crawlers are allowed by the generic robots rule; private routes retain their exclusions. No separate crawler-specific page or inflated keyword block is used.

Google explicitly states that AI Overviews and AI Mode require the same SEO fundamentals, with no special AI text file or schema required. Inclusion is not guaranteed. [Google guidance](https://developers.google.com/search/docs/appearance/ai-features)

FAQ structured data is retained for accurate machine-readable semantics. Google retired FAQ rich results in May 2026; it is not represented here as a rich-result opportunity. [Google documentation changelog](https://developers.google.com/search/updates)

## Validation

The final production build completed successfully, including TypeScript and all 37 generated pages. The final local crawl passed **2,315 assertions across 26 public pages, 40 internal links and one social image, with zero failures and zero warnings**. All 106 converter assertions and the translation/navigation regression checks passed. ESLint passed for all 48 changed/new source files; git diff whitespace checks passed. Separate configuration checks confirmed preview deployments receive noindex while production does not receive a blanket noindex header.

Automated coverage includes:

- Every sitemap URL returns 200, is indexable, has one H1, a self-canonical, unique title and description, and full social metadata.
- Correct Persian lang/dir, real reciprocal hreflang targets and matching sitemap language families.
- Valid JSON-LD with canonical origins; no unrelated homepage WebPage on child routes.
- Social image availability and actual PNG dimensions.
- Privacy-policy discovery, private-route exclusions, auth noindex, locale/legal redirects and missing-page 404s.
- Public internal links and fragment targets.
- Converter fee boundaries/config changes, both currencies/languages, decimal input and both Persian/Arabic digit forms.
- Language-path mappings checked against actual article translations and service data.

Commands, with the production server running on port 3100:

```powershell
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3100
npm.cmd run test:seo -- http://127.0.0.1:3100
npm.cmd run test:converter
node scripts/test-language-paths.cjs
```

A broader lint scan surfaced existing errors in untouched dashboard utilities, login JSX and the decorative AboutGlobe; these were not introduced by this work. Changed-file lint is the relevant check for this patch, alongside the full build.

No connected browser was available through the computer-use tool, including the in-app browser. Therefore a visual mobile/desktop and interactive hydration pass is still required. HTML/SSR assertions are not a substitute for that check. The observed live Persian homepage before changes was 490,952 bytes; the first local build was 339,412 bytes (about 31% smaller uncompressed). This is a payload comparison, not a measured Core Web Vitals improvement; production data/reviews can change payload size.

## Deployment and external work still required

1. Deploy the reviewed working-tree changes. On the hosting domain settings, make non-www to www a permanent 308/301 redirect. The existing upstream 307 cannot be corrected by metadata alone. Keep one preferred hostname and ensure HTTP redirects to HTTPS.
2. After rollout, run the crawler against https://www.zarman.com.au, inspect Google-rendered HTML for both languages, and submit https://www.zarman.com.au/sitemap.xml in Google Search Console and Bing Webmaster Tools. A Google verification environment token is configured locally; this does not establish access to Search Console reports. Bing verification is supported with NEXT_PUBLIC_BING_VERIFICATION_TOKEN, currently absent locally. DNS verification is also an option.
3. Confirm current AUSTRAC registration and the exact public registration identifier in the official register. The ABN record was independently verified as ZARMAN EXCHANGE PTY LTD, ABN 70 692 742 957, active from 11 November 2025. An ABN and AUSTRAC registration are distinct facts; neither is described as a guarantee of individual transfers. [Official ABN record](https://abr.business.gov.au/ABN/View?id=70692742957)
4. Have the business reviewer confirm service availability, payment corridors, support hours, source-of-funds requirements, quote validity, fees and settlement wording. Existing legal policies were preserved, including their branch, retention and liability statements; this audit is not approval of those statements. Produce professionally reviewed Persian policies if they should be offered in Persian. Currently Persian legal URLs correctly lead to English policies.
5. Confirm publication consent and profile-field RLS for approved testimonials. The new renderer uses the same existing public access, only first name/last initial, and omits the section on missing data. The database and consent records were not audited.
6. Verify Google Business Profile eligibility before creating or expanding a listing. Keep public legal name, contact details and actual service areas consistent across owned profiles. Do not invent addresses, reviews, local offices, licenses or expert credentials.
7. Measure mobile and desktop Core Web Vitals using production field data and PageSpeed Insights. Target good field LCP (<=2.5s), INP (<=200ms) and CLS (<=0.1) at the 75th percentile. Audit the remaining WebGL/chart bundles and fonts based on those measurements, rather than assuming a passing build proves performance. [Web Vitals thresholds](https://web.dev/articles/vitals)
8. Confirm Vercel analytics/Speed Insights are enabled and production requests are received. Check any CDN/WAF crawler restrictions. Robots allowance does not override an upstream bot challenge.

## First 90 days after rollout

- First week: verify redirects, canonical selection, indexed Persian/English pages, sitemap processing and structured data. Confirm the private pages stay out of search and no preview deployment is indexable.
- Weeks 2–4: establish Search Console baselines by /fa and /en, country, device, brand/non-brand query, impressions, clicks, CTR and completed customer inquiries. Analyze rate queries separately from transfer-intent queries.
- Weeks 4–8: use actual query gaps to expand useful Persian guides on quote comparison, transfer documentation and student payment preparation. Include reviewed examples and dated sources. Create real English counterparts where useful and update translation mappings/tests together.
- Weeks 8–12: improve pages with impressions but low engagement; check titles against actual intent and measure leads. Review Bing AI citation/grounding-query reports and referral traffic from AI products. Keep a small reproducible set of Persian questions for periodic citation checks; do not treat one AI answer as a stable rank.

Bing provides an AI Performance report for citations and grounding queries across supported Microsoft/partner experiences. [Bing AI Performance documentation](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c)

## Reference standards

- [Google localized-page annotations](https://developers.google.com/search/docs/specialty/international/localized-versions)
- [Google multilingual site guidance](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- [Google robots.txt limitations](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
- [RBA: drivers of the Australian dollar exchange rate](https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html)
