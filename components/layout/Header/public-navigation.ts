import { getPublicNavItems, type NavItem } from "@/data/navigation";

/** Keep page navigation useful from every public route, in either language. */
export function getCrawlablePublicNavItems(locale: "fa" | "en"): NavItem[] {
  const items = getPublicNavItems(locale).map((item) => ({
    ...item,
    href:
      item.href === "#hero"
        ? `/${locale}`
        : item.href === "#about"
          ? `/${locale}/about`
          : item.href === "#services"
            ? `/${locale}/services`
            : `/${locale}${item.href}`,
  }));

  items.splice(4, 0, {
    label: locale === "fa" ? "راهنما و مقالات" : "Guides",
    href: `/${locale}/blog`,
  });

  return items;
}
