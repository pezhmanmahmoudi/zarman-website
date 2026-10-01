import type { ReactNode } from "react";

// The redirect-only entry route has its own document. Admin and locale routes
// use their existing root layouts so their document attributes stay independent.
export default function EntryLayout({ children }: { children: ReactNode }) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
