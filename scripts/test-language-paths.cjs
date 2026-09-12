/* eslint-disable @typescript-eslint/no-require-imports -- Compile the actual TS navigation modules without a browser or database. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

const root = path.resolve(__dirname, "..");
function compile(file, localRequire = require) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })(localRequire, compiled, compiled.exports);
  return compiled.exports;
}

const languagePaths = compile("components/ui/LanguageSwitcher/alternate-language-path.ts");
const { getAlternateLanguagePath, getSharedLanguageHash, blogLanguagePaths } = languagePaths;
const { blogPosts, getBlogAlternatePaths } = compile("data/blog-posts.ts");
const { services } = compile("data/services.ts");
let currentLocale = "fa";
let currentPathname = "/fa";

function navigationRequire(id) {
  if (id === "next/navigation") return { usePathname: () => currentPathname };
  if (id === "@/context/LocaleContext") return { useLocale: () => currentLocale };
  if (id === "./alternate-language-path") return languagePaths;
  if (id.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  return require(id);
}
const { LanguageSwitcher } = compile("components/ui/LanguageSwitcher/LanguageSwitcher.tsx", navigationRequire);
const ContentNavigation = compile("components/layout/ContentNavigation.tsx", (id) => {
  if (id === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
  if (id === "@/components/ui/LanguageSwitcher/LanguageSwitcher") return { LanguageSwitcher };
  return navigationRequire(id);
}).default;

function assertServerLink(locale, pathname, target) {
  currentLocale = locale;
  currentPathname = pathname;
  for (const variant of ["pill", "menu-item"]) {
    const html = renderToStaticMarkup(React.createElement(LanguageSwitcher, { variant }));
    assert.match(html, /<a\b/, "Language selection must expose an anchor in initial HTML");
    assert.ok(html.includes(`href="${target}"`), `${pathname} must link to ${target}`);
    assert.match(html, new RegExp(`hreflang="${locale === "fa" ? "en" : "fa"}"`, "i"));
    assert.doesNotMatch(html, /<button\b/, "The alternate page must be discoverable without clicking a button");
  }
}

for (const post of blogPosts) {
  const targetLocale = post.locale === "fa" ? "en" : "fa";
  const counterpart = blogPosts.find((entry) => entry.translationKey === post.translationKey && entry.locale === targetLocale);
  assert.ok(counterpart, `Missing ${targetLocale} translation for ${post.translationKey}`);
  const source = `/${post.locale}/blog/${post.slug}`;
  const target = `/${targetLocale}/blog/${counterpart.slug}`;
  assert.equal(getAlternateLanguagePath(source, targetLocale), target, "Client language mapping must match editorial translation keys");
  assert.equal(getAlternateLanguagePath(target, post.locale), source, "Language links must round-trip");
  assert.equal(`/${targetLocale}${getBlogAlternatePaths(post)[targetLocale]}`, target, "Visible language links and metadata hreflang must agree");
  assertServerLink(post.locale, source, target);
}

assert.equal(blogLanguagePaths.length, new Set(blogPosts.map((post) => post.translationKey)).size, "Client mapping must not omit or retain stale article pairs");
for (const pair of blogLanguagePaths) {
  const matching = ["fa", "en"].map((locale) => blogPosts.find((post) => post.locale === locale && post.slug === pair[locale]));
  assert.ok(matching.every(Boolean), "Mapped article slugs must exist");
  assert.equal(matching[0].translationKey, matching[1].translationKey, "Mapped slugs must describe the same article");
}

for (const service of services) {
  const targetLocale = service.locale === "fa" ? "en" : "fa";
  assert.ok(services.some((entry) => entry.locale === targetLocale && entry.slug === service.slug), "Services must have an equivalent-language destination");
  assertServerLink(service.locale, `/${service.locale}/services/${service.slug}`, `/${targetLocale}/services/${service.slug}`);
}

for (const locale of ["fa", "en"]) {
  for (const contentPath of ["", "/about", "/services", "/blog", "/legal/privacy-policy"]) {
    const pathname = `/${locale}${contentPath}`;
    assertServerLink(locale, pathname, `/${locale === "fa" ? "en" : "fa"}${contentPath}`);
    const html = renderToStaticMarkup(React.createElement(ContentNavigation, { locale, currentPath: contentPath }));
    assert.match(html, new RegExp(`dir="${locale === "fa" ? "rtl" : "ltr"}"`));
    for (const destination of ["", "/about", "/services", "/blog"]) {
      assert.ok(html.includes(`href="/${locale}${destination}"`), "Content navigation must render local discovery links on the server");
    }
  }
}

assert.equal(getAlternateLanguagePath("/", "en"), "/en");
assert.equal(getAlternateLanguagePath("/en/", "fa"), "/fa");
assert.equal(getAlternateLanguagePath("/en/blog/unknown-article", "fa"), "/fa/blog");
for (const hash of ["#hero", "#rates", "#about", "#services", "#how-it-works", "#faq", "#contact"]) {
  assert.equal(getSharedLanguageHash("/fa", hash), hash);
  assert.equal(getSharedLanguageHash("/en/", hash), hash);
}
assert.equal(getSharedLanguageHash("/en/blog/aud-to-irt-exchange-rate-guide", "#localized-heading"), "");
assert.equal(getSharedLanguageHash("/fa", "#unknown-section"), "");
assert.equal(getSharedLanguageHash("/en/about", "#main-content"), "#main-content");

// A fragment changed by history.pushState may not emit hashchange. Read it at click time.
currentLocale = "fa";
currentPathname = "/fa";
const previousWindow = global.window;
try {
  global.window = { location: { hash: "#rates" } };
  let navigated = false;
  const anchor = LanguageSwitcher({ onNavigate: () => { navigated = true; } });
  const currentTarget = { href: anchor.props.href };
  anchor.props.onClick({ currentTarget });
  assert.equal(currentTarget.href, "/en#rates");
  assert.equal(navigated, true);
} finally {
  if (previousWindow === undefined) delete global.window;
  else global.window = previousWindow;
}

for (const template of ["blog/page.tsx", "blog/[slug]/page.tsx", "services/page.tsx", "services/[slug]/page.tsx", "about/page.tsx"]) {
  const source = fs.readFileSync(path.join(root, "app/[locale]", template), "utf8");
  assert.match(source, /<ContentNavigation\s/, `${template} must include crawlable navigation and an alternate-language link`);
  assert.doesNotMatch(source, /<main\b/, "Content templates must not nest another main landmark inside the locale layout");
}

console.log(`Language navigation passed: ${blogPosts.length} articles, ${services.length} services, both locales and server-rendered content navigation.`);
