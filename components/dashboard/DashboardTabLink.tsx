"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & { href: string };

/** Dashboard tabs are client state. Keep them in browser history without fetching the same server route again. */
export function DashboardTabLink({ href, replace, scroll, prefetch, ...props }: Props) {
  const pathname = usePathname();
  const localTab = /^\/(en|fa)\/dashboard$/.test(pathname) && href.split(/[?#]/, 1)[0] === pathname && !href.includes("#");

  return <Link {...props} href={href} replace={replace} scroll={scroll} prefetch={localTab ? false : prefetch}
    onNavigate={localTab ? event => {
      // Next invokes onNavigate only for an ordinary same-window navigation;
      // modified clicks, downloads and new tabs retain their native behavior.
      event.preventDefault();
      if (href !== window.location.pathname + window.location.search) {
        if (replace) window.history.replaceState(null, "", href);
        else window.history.pushState(null, "", href);
      }
      if (scroll !== false) window.scrollTo({ top: 0, behavior: "instant" });
    } : undefined} />;
}
