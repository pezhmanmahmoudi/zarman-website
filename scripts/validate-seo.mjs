#!/usr/bin/env node
/**
 * Read-only integration audit for the rendered, built site. Start the server first:
 *   node scripts/validate-seo.mjs http://127.0.0.1:3100
 *
 * Uses Node's built-in fetch and a deliberately small parser for the HTML/XML
 * emitted by Next.js. This checks crawlability and metadata, not rankings,
 * JavaScript interaction, accessibility in general, or external legal claims.
 */
const PRODUCTION = "https://www.zarman.com.au";
const requestedOrigin = new URL(process.argv[2] ?? "http://127.0.0.1:3100");
if (!/^https?:$/.test(requestedOrigin.protocol) || requestedOrigin.pathname !== "/") {
  throw new Error("Supply an HTTP(S) origin without a path, e.g. http://127.0.0.1:3100");
}
const targetOrigin = requestedOrigin.origin;
const failures = new Set();
const warnings = new Set();
const responses = new Map();
const parsedPages = new Map();
const imageChecks = new Map();
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.add(message);
  return Boolean(condition);
}

function decodeEntities(value = "") {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    if (!entity.startsWith("#")) return named[entity.toLowerCase()] ?? match;
    const point = entity[1].toLowerCase() === "x"
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  });
}

function attributes(tag = "") {
  const result = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}

function visibleHtml(html) {
  return html.replace(/<!--[^]*?-->/g, "")
    .replace(/<script\b[^>]*>[^]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[^]*?<\/style\s*>/gi, "");
}

function textContent(html = "") {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function parsePage(response) {
  if (parsedPages.has(response.url)) return parsedPages.get(response.url);
  const html = response.text;
  const markup = visibleHtml(html);
  const metas = new Map();
  for (const match of markup.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const name = (attrs.name ?? attrs.property ?? "").toLowerCase();
    if (name) metas.set(name, [...(metas.get(name) ?? []), attrs.content ?? ""]);
  }
  const links = [...markup.matchAll(/<link\b[^>]*>/gi)].map((match) => attributes(match[0]));
  const canonical = links.filter((link) => link.rel?.toLowerCase() === "canonical");
  const alternates = links.filter((link) => link.rel?.toLowerCase() === "alternate" && link.hreflang);
  const page = {
    ...response,
    markup,
    htmlAttributes: attributes(markup.match(/<html\b[^>]*>/i)?.[0]),
    metas,
    canonical,
    alternates,
    title: textContent(markup.match(/<title\b[^>]*>([^]*?)<\/title>/i)?.[1]),
    titles: [...markup.matchAll(/<title\b[^>]*>/gi)],
    headings: [...markup.matchAll(/<h1\b[^>]*>([^]*?)<\/h1\s*>/gi)].map((match) => textContent(match[1])),
    anchors: [...markup.matchAll(/<a\b[^>]*>/gi)].map((match) => attributes(match[0])),
    ids: new Set([...markup.matchAll(/<[a-z][^>]*>/gi)].map((match) => attributes(match[0]).id).filter(Boolean)),
    jsonLd: [],
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([^]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try {
      page.jsonLd.push(JSON.parse(match[2]));
    } catch (error) {
      check(false, `${new URL(response.url).pathname}: invalid JSON-LD: ${error.message}`);
    }
  }
  parsedPages.set(response.url, page);
  return page;
}

function internal(url) {
  return ["zarman.com.au", "www.zarman.com.au", requestedOrigin.hostname].includes(url.hostname);
}

function localUrl(url) {
  const parsed = new URL(url, PRODUCTION);
  if (!internal(parsed)) throw new Error(`Refusing to crawl an external site: ${url}`);
  return new URL(`${parsed.pathname}${parsed.search}`, targetOrigin).href;
}

async function request(url) {
  const absolute = new URL(url, PRODUCTION).href;
  if (!responses.has(absolute)) {
    responses.set(absolute, (async () => {
      try {
        const response = await fetch(localUrl(absolute), {
          redirect: "manual",
          signal: AbortSignal.timeout(20_000),
          headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot; ZarmanSEOAudit/1.0)", accept: "text/html,application/xml,text/plain,*/*" },
        });
        const bytes = Buffer.from(await response.arrayBuffer());
        return { url: absolute, status: response.status, headers: response.headers, bytes, text: bytes.toString("utf8") };
      } catch (error) {
        check(false, `${new URL(absolute).pathname}: request failed: ${error.message}`);
        return { url: absolute, status: 0, headers: new Headers(), bytes: Buffer.alloc(0), text: "" };
      }
    })());
  }
  return responses.get(absolute);
}

async function concurrent(items, fn, count = 5) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

function meta(page, name) {
  return page.metas.get(name)?.[0] ?? "";
}

function isNoindex(page) {
  const directives = [page.headers.get("x-robots-tag"), ...["robots", "googlebot", "bingbot"].flatMap((name) => page.metas.get(name) ?? [])];
  return directives.some((value) => /(?:^|[\s,:])(?:noindex|none)(?:[\s,;]|$)/i.test(value ?? ""));
}

function schemaNodes(value, nodes = []) {
  if (Array.isArray(value)) value.forEach((entry) => schemaNodes(entry, nodes));
  else if (value && typeof value === "object") {
    nodes.push(value);
    Object.values(value).forEach((entry) => schemaNodes(entry, nodes));
  }
  return nodes;
}

async function readSitemap(url = `${PRODUCTION}/sitemap.xml`, visited = new Set()) {
  if (!check(!visited.has(url), `Circular sitemap reference: ${url}`)) return [];
  visited.add(url);
  const response = await request(url);
  if (!check(response.status === 200, `${url}: sitemap status ${response.status}, expected 200`)) return [];
  check(/xml/i.test(response.headers.get("content-type") ?? ""), `${url}: expected an XML content type`);
  if (/<sitemapindex\b/i.test(response.text)) {
    const entries = [];
    for (const match of response.text.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) {
      entries.push(...await readSitemap(decodeEntities(match[1].trim()), visited));
    }
    return entries;
  }
  check(/<urlset\b/.test(response.text), `${url}: missing urlset element`);
  return [...response.text.matchAll(/<url>\s*([^]*?)<\/url>/g)].map((match) => ({
    url: decodeEntities(match[1].match(/<loc>\s*([^<]+)\s*<\/loc>/)?.[1]?.trim() ?? ""),
    lastmod: match[1].match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/)?.[1]?.trim(),
    alternates: [...match[1].matchAll(/<(?:xhtml:)?link\b[^>]*>/g)].map((entry) => attributes(entry[0])).filter((entry) => entry.hreflang),
  }));
}

async function checkImage(url, width, height, pagePath) {
  let parsed;
  try { parsed = new URL(url); } catch { check(false, `${pagePath}: image URL is not absolute: ${url}`); return; }
  check(parsed.protocol === "https:", `${pagePath}: social image must use HTTPS`);
  if (!internal(parsed)) return;
  if (!imageChecks.has(url)) {
    imageChecks.set(url, (async () => {
      const response = await request(url);
      check(response.status === 200, `${url}: image status ${response.status}, expected 200`);
      check(/^image\//i.test(response.headers.get("content-type") ?? ""), `${url}: image has a non-image content type`);
      // The site's current social image is PNG. Validate its real IHDR dimensions.
      if (response.bytes.length >= 24 && response.bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
        return { width: response.bytes.readUInt32BE(16), height: response.bytes.readUInt32BE(20) };
      }
      return null;
    })());
  }
  const size = await imageChecks.get(url);
  if (size && width && height) check(size.width === Number(width) && size.height === Number(height), `${pagePath}: OG declares ${width}×${height}, actual image is ${size.width}×${size.height}`);
}

async function validatePage(entry, titles) {
  const response = await request(entry.url);
  const path = new URL(entry.url).pathname;
  if (!check(response.status === 200, `${path}: sitemap page status ${response.status}, expected 200 without redirect`)) return;
  const page = parsePage(response);
  check(/text\/html/i.test(page.headers.get("content-type") ?? ""), `${path}: expected an HTML response`);
  check(!isNoindex(page), `${path}: indexable sitemap page has noindex`);
  check(page.canonical.length === 1, `${path}: expected exactly one canonical link`);
  check(page.canonical[0]?.href === entry.url, `${path}: canonical must equal ${entry.url}; found ${page.canonical[0]?.href}`);
  const locale = path.split("/")[1];
  check(page.htmlAttributes.lang === locale || (locale === "en" && page.htmlAttributes.lang === "en-AU"), `${path}: HTML lang must match the page language`);
  check(page.htmlAttributes.dir === (locale === "fa" ? "rtl" : "ltr"), `${path}: incorrect HTML text direction`);
  check(page.headings.length === 1 && Boolean(page.headings[0]), `${path}: expected one nonempty H1; found ${page.headings.length}`);
  check(page.titles.length === 1, `${path}: expected exactly one title element`);
  const titleLength = [...page.title].length;
  check(titleLength >= 10 && titleLength <= 110, `${path}: title length ${titleLength} is outside the audit range 10–110`);
  if (titleLength > 70) warnings.add(`${path}: title is ${titleLength} characters; review search-result truncation`);
  const duplicate = titles.get(page.title);
  check(!duplicate, `${path}: duplicate title also used by ${duplicate}`);
  titles.set(page.title, path);
  check(!/&(?:amp|lt|gt|quot);/i.test(page.title), `${path}: title contains a literal encoded HTML entity`);
  const description = meta(page, "description");
  const descriptionLength = [...description].length;
  check(page.metas.get("description")?.length === 1, `${path}: expected one description`);
  check(descriptionLength >= 40 && descriptionLength <= 240, `${path}: description length ${descriptionLength} is outside the audit range 40–240`);
  if (descriptionLength > 180) warnings.add(`${path}: description is ${descriptionLength} characters; review truncation`);
  for (const name of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "og:locale", "og:image", "og:image:width", "og:image:height", "og:image:alt", "og:image:type", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
    check(Boolean(meta(page, name)), `${path}: missing ${name} metadata`);
  }
  check(meta(page, "og:url") === entry.url, `${path}: og:url must match canonical`);
  check(meta(page, "og:title") === page.title && meta(page, "twitter:title") === page.title, `${path}: social titles must match the document title`);
  check(meta(page, "og:description") === description && meta(page, "twitter:description") === description, `${path}: social descriptions must match the page description`);
  check(meta(page, "og:locale") === (locale === "fa" ? "fa_IR" : "en_AU"), `${path}: incorrect Open Graph locale`);
  check(meta(page, "twitter:card") === "summary_large_image", `${path}: expected a large-image Twitter card`);
  if (meta(page, "og:image")) await checkImage(meta(page, "og:image"), meta(page, "og:image:width"), meta(page, "og:image:height"), path);
  if (meta(page, "twitter:image")) await checkImage(meta(page, "twitter:image"), null, null, path);
  check(page.jsonLd.length > 0, `${path}: no JSON-LD found`);
  const nodes = schemaNodes(page.jsonLd);
  const hasType = (name) => nodes.some((node) => [node["@type"]].flat().includes(name));
  const pageType = /\/blog\/[^/]+$/.test(path) ? "Article" : /\/services\/[^/]+$/.test(path) ? "Service" : /\/about$/.test(path) ? "AboutPage" : /\/blog$/.test(path) ? "CollectionPage" : null;
  if (pageType) check(hasType(pageType), `${path}: missing ${pageType} structured data`);
  for (const node of nodes) {
    const types = [node["@type"]].flat();
    if (!/^\/(?:en|fa)$/.test(path) && types.includes("WebPage")) {
      check(![node.url, node["@id"]].some((value) => typeof value === "string" && /^https:\/\/(?:www\.)?zarman\.com\.au\/(?:(?:fa|en)\/?)?(?:#.*)?$/.test(value)), `${path}: child page includes homepage WebPage structured data`);
    }
    for (const name of ["@id", "url", "mainEntityOfPage"]) {
      if (typeof node[name] === "string" && /^https?:\/\/(?:www\.)?zarman\.com\.au(?:\/|$)/.test(node[name])) {
        check(new URL(node[name]).origin === PRODUCTION, `${path}: schema ${name} uses a noncanonical origin: ${node[name]}`);
      }
    }
    if (types.includes("Article")) {
      check(Boolean(node.datePublished) && Number.isFinite(Date.parse(node.datePublished)), `${path}: Article needs a valid publication date`);
      if (node.dateModified) check(Date.parse(node.dateModified) >= Date.parse(node.datePublished), `${path}: modification date is earlier than publication date`);
      check(Boolean(node.author), `${path}: Article author is missing`);
    }
  }
  if (entry.lastmod) {
    const date = Date.parse(entry.lastmod);
    check(Number.isFinite(date) && date <= Date.now() + 86_400_000, `${path}: sitemap lastmod is invalid or in the future`);
  }
  const alternateMap = new Map(page.alternates.map((link) => [link.hreflang, link.href]));
  check(alternateMap.size === page.alternates.length, `${path}: duplicate hreflang labels`);
  check(!alternateMap.has("fa-IR"), `${path}: use generic fa hreflang for the Persian-speaking audience`);
  check(alternateMap.get(locale) === entry.url, `${path}: missing self-referencing ${locale} hreflang`);
  if (locale === "en") check(alternateMap.get("en-AU") === entry.url, `${path}: missing self-referencing en-AU hreflang`);
  check(Boolean(alternateMap.get("x-default")), `${path}: missing x-default hreflang`);
  if (/\/legal\//.test(path)) check(!alternateMap.has("fa"), `${path}: English-only legal page advertises a Persian translation`);
  const sitemapAlternates = new Map(entry.alternates.map((link) => [link.hreflang, link.href]));
  // A single-language page can omit XML hreflang; HTML self/region aliases are
  // valid and do not mean another translated document exists.
  const untranslatedWithoutXml = sitemapAlternates.size === 0 && new Set(alternateMap.values()).size === 1;
  check(untranslatedWithoutXml || (sitemapAlternates.size === alternateMap.size && [...alternateMap].every(([language, href]) => sitemapAlternates.get(language) === href)), `${path}: sitemap hreflang and HTML hreflang differ`);
  await concurrent([...alternateMap], async ([language, href]) => {
    if (!check(typeof href === "string" && href.startsWith(`${PRODUCTION}/`), `${path}: ${language} alternate must use the production origin`)) return;
    const alternateResponse = await request(href);
    if (!check(alternateResponse.status === 200, `${path}: ${language} alternate ${href} returned ${alternateResponse.status}; expected 200 without redirect`)) return;
    const alternatePage = parsePage(alternateResponse);
    check(alternatePage.canonical[0]?.href === href, `${path}: ${language} alternate is not self-canonical`);
    check(!isNoindex(alternatePage), `${path}: ${language} alternate is noindex`);
    const targetMap = new Map(alternatePage.alternates.map((link) => [link.hreflang, link.href]));
    check([...alternateMap].every(([code, target]) => targetMap.get(code) === target), `${path}: ${language} alternate lacks the same reciprocal hreflang family`);
  }, 3);
}

function parseRobots(text) {
  const groups = [];
  let group = null;
  let hasRules = false;
  for (const line of text.split(/\r?\n/)) {
    const match = line.replace(/#.*$/, "").match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    if (key === "user-agent") {
      if (!group || hasRules) { group = { agents: [], rules: [] }; groups.push(group); hasRules = false; }
      group.agents.push(match[2].toLowerCase());
    } else if ((key === "allow" || key === "disallow") && group) {
      group.rules.push({ allow: key === "allow", path: match[2] });
      hasRules = true;
    }
  }
  return groups;
}

function allowed(groups, path, agent = "googlebot") {
  const matched = groups.map((group) => ({ ...group, specificity: Math.max(-1, ...group.agents.filter((name) => name === "*" || agent.includes(name)).map((name) => name === "*" ? 0 : name.length)) }));
  const specificity = Math.max(-1, ...matched.map((group) => group.specificity));
  let best = { length: -1, allow: true };
  for (const group of matched.filter((entry) => entry.specificity >= 0 && entry.specificity === specificity)) {
    for (const rule of group.rules) {
      if (!rule.path) continue;
      const escaped = rule.path.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
      if (new RegExp(`^${escaped}`).test(path)) {
        const length = rule.path.replace(/[\*$]/g, "").length;
        if (length > best.length || (length === best.length && rule.allow)) best = { length, allow: rule.allow };
      }
    }
  }
  return best.allow;
}

async function validateRobots(entries) {
  const response = await request(`${PRODUCTION}/robots.txt`);
  if (!check(response.status === 200, `/robots.txt: expected 200, got ${response.status}`)) return;
  const groups = parseRobots(response.text);
  check(groups.length > 0, "/robots.txt: no user-agent rules found");
  check(response.text.includes(`Sitemap: ${PRODUCTION}/sitemap.xml`), "/robots.txt: missing production sitemap URL");
  for (const path of ["/api/seo-audit-check", "/admin", "/admin/login", "/fa/dashboard", "/en/dashboard", "/fa/dashboard/", "/en/dashboard/"]) {
    check(!allowed(groups, path), `/robots.txt: private path is not disallowed: ${path}`);
  }
  for (const entry of entries) {
    for (const agent of ["googlebot", "bingbot", "oai-searchbot"]) {
      check(allowed(groups, new URL(entry.url).pathname, agent), `/robots.txt: ${agent} is blocked from sitemap URL ${entry.url}`);
    }
  }
  for (const locale of ["fa", "en"]) {
    for (const route of ["login", "forgot-password", "reset-password", "auth/confirm"]) {
      const path = `/${locale}/${route}`;
      const page = await request(`${PRODUCTION}${path}`);
      if (page.status === 200) check(isNoindex(parsePage(page)), `${path}: account/authentication page must be noindex`);
      else check([301, 302, 303, 307, 308].includes(page.status), `${path}: authentication route failed with ${page.status}`);
      if (!allowed(groups, path)) warnings.add(`${path}: robots.txt blocks crawling; crawlers cannot read its noindex directive`);
    }
  }
}

async function validateSpecialRoutes() {
  for (const path of ["/", "/?utm_source=seo-audit&from=%2Fservices&campaign=fa"]) {
    const response = await request(`${PRODUCTION}${path}`);
    check(response.status === 308, `${path}: expected permanent 308 redirect, got ${response.status}`);
    const location = new URL(response.headers.get("location") ?? "/__missing-location", PRODUCTION);
    check(location.pathname === "/fa", `${path}: root must redirect to /fa`);
    check(location.search === new URL(path, PRODUCTION).search, `${path}: redirect lost or changed query parameters`);
  }
  for (const slug of ["terms", "privacy-policy", "dvs-consent", "dvs-notice"]) {
    const path = `/fa/legal/${slug}`;
    const response = await request(`${PRODUCTION}${path}`);
    check(response.status === 308, `${path}: expected 308 to the English legal page, got ${response.status}`);
    const location = new URL(response.headers.get("location") ?? "/__missing-location", PRODUCTION);
    check(location.pathname === `/en/legal/${slug}`, `${path}: redirect target is incorrect`);
  }
  for (const locale of ["fa", "en"]) {
    for (const section of ["blog", "services"]) {
      const path = `/${locale}/${section}/__seo-audit-missing__`;
      const response = await request(`${PRODUCTION}${path}`);
      check(response.status === 404, `${path}: missing content must return 404, got ${response.status}`);
      if (response.status) check(isNoindex(parsePage(response)), `${path}: missing content must carry noindex`);
    }
  }
}

async function validateInternalLinks(entries) {
  const links = new Map();
  for (const entry of entries) {
    const response = await request(entry.url);
    if (response.status !== 200) continue;
    for (const anchor of parsePage(response).anchors) {
      if (!anchor.href || /^(?:mailto:|tel:|javascript:|data:)/i.test(anchor.href)) continue;
      let url;
      try { url = new URL(anchor.href, entry.url); } catch { check(false, `${entry.url}: malformed link ${anchor.href}`); continue; }
      if (!internal(url) || !/^https?:$/.test(url.protocol)) continue;
      if (/^\/(?:api|admin|_next)(?:\/|$)|^\/(?:en|fa)\/(?:dashboard|auth)(?:\/|$)/.test(url.pathname)) continue;
      if (url.hostname === "zarman.com.au") warnings.add(`${new URL(entry.url).pathname}: internal link uses the noncanonical hostname: ${anchor.href}`);
      // Queries do not define separate public content routes in this application.
      url.search = "";
      links.set(url.href, entry.url);
    }
  }
  if (links.size > 150) warnings.add(`Internal link check capped at 150 of ${links.size} unique links`);
  await concurrent([...links].slice(0, 150), async ([href, source]) => {
    let url = new URL(href);
    const hash = url.hash;
    url.hash = "";
    let response;
    for (let step = 0; step < 6; step += 1) {
      response = await request(url.href);
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!check(Boolean(location), `${source}: redirect has no location: ${href}`)) return;
      url = new URL(location, url);
      if (!internal(url)) return;
    }
    if (!check(response?.status === 200, `${new URL(source).pathname}: internal link ${href} ends with status ${response?.status}`)) return;
    if (hash.length > 1 && /text\/html/i.test(response.headers.get("content-type") ?? "")) {
      let id;
      try { id = decodeURIComponent(hash.slice(1)); } catch { check(false, `${source}: invalid encoded fragment ${hash}`); return; }
      check(parsePage(response).ids.has(id), `${new URL(source).pathname}: internal link ${href} has no matching element ID`);
    }
  });
  return Math.min(links.size, 150);
}

async function main() {
  console.log(`Auditing ${targetOrigin}; expected canonical origin: ${PRODUCTION}`);
  const entries = await readSitemap();
  if (!check(entries.length > 0, "Sitemap contains no URLs")) return;
  const seen = new Set();
  const valid = [];
  for (const entry of entries) {
    let url;
    try { url = new URL(entry.url); } catch { check(false, `Invalid sitemap URL: ${entry.url}`); continue; }
    check(url.origin === PRODUCTION, `Sitemap URL uses the wrong production origin: ${entry.url}`);
    check(!url.hash && !url.search, `Sitemap URL must not contain a query or fragment: ${entry.url}`);
    check(!seen.has(entry.url), `Duplicate sitemap URL: ${entry.url}`);
    check(!/^\/(?:api|admin)(?:\/|$)|^\/(?:en|fa)\/(?:dashboard|login|auth|forgot-password|reset-password)(?:\/|$)/.test(url.pathname), `Private/auth route in sitemap: ${entry.url}`);
    check(!/^\/fa\/legal\//.test(url.pathname), `Redirecting Persian legal URL in sitemap: ${entry.url}`);
    seen.add(entry.url);
    if (internal(url)) valid.push(entry);
  }
  for (const locale of ["fa", "en"]) {
    for (const route of ["", "/about", "/services", "/blog", "/register"]) {
      check(seen.has(`${PRODUCTION}/${locale}${route}`), `Missing public route in sitemap: /${locale}${route}`);
    }
    for (const section of ["services", "blog"]) check(entries.some((entry) => entry.url.startsWith(`${PRODUCTION}/${locale}/${section}/`)), `Sitemap has no ${locale} ${section} detail pages`);
  }
  for (const slug of ["terms", "privacy-policy", "dvs-consent", "dvs-notice"]) check(seen.has(`${PRODUCTION}/en/legal/${slug}`), `Missing English legal page in sitemap: ${slug}`);
  console.log(`Checking ${valid.length} sitemap pages, their translation families and social images…`);
  const titles = new Map();
  await concurrent(valid, (entry) => validatePage(entry, titles));
  console.log("Checking robots, account-page indexing, redirects, missing content and internal links…");
  await validateRobots(valid);
  await validateSpecialRoutes();
  const linkCount = await validateInternalLinks(valid);
  console.log(`Checked ${valid.length} public pages, ${linkCount} internal links and ${imageChecks.size} social image(s).`);
}

try {
  await main();
} catch (error) {
  check(false, `Audit could not complete: ${error.stack ?? error.message}`);
}
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const failure of failures) console.error(`FAIL ${failure}`);
console.log(`${checks} assertions; ${failures.size} failure(s); ${warnings.size} warning(s).`);
process.exitCode = failures.size ? 1 : 0;
