import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerComponentClient } from "@/lib/supabase-server";
import { getAdminNavigationCounts } from "@/app/actions/admin.actions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import shellStyles from "@/styles/admin/AdminShell.module.css";

export const metadata: Metadata = {
  title: "Admin Panel | Zarman Exchange",
  robots: { index: false, follow: false },
};

/**
 * Admin layout — server component that:
 *  1. Verifies the user has the admin role (server-side).
 *  2. Renders the persistent sidebar + top bar.
 *  3. Wraps page content.
 *
 * Middleware already redirects non-admins, but this is a belt-and-suspenders
 * check so that direct server-side renders also fail securely.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabaseServer = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();

  // Double-check: if middleware was bypassed somehow, redirect here too.
  if (!user || user.app_metadata?.role !== "admin") {
    redirect("/admin/login");
  }

  // Fetch pending counts for sidebar badges — best-effort (don't fail the whole layout).
  let pendingKyc = 0;
  let pendingTx = 0;
  let pendingFeedback = 0;
  try {
    const stats = await getAdminNavigationCounts();
    pendingKyc = stats.pendingKycCount;
    pendingTx = stats.pendingTxCount;
    pendingFeedback = stats.pendingFeedbackCount;
  } catch {
    // Stats failure should not block admin access.
  }

  return (
    <div className={shellStyles.adminShell}>
      <a href="#admin-main" className={shellStyles.skipLink}>Skip to page content</a>
      <AdminSidebar
        adminEmail={user.email ?? ""}
        pendingKyc={pendingKyc}
        pendingTx={pendingTx}
        pendingFeedback={pendingFeedback}
      />
      <main id="admin-main" tabIndex={-1} className={shellStyles.mainArea}>{children}</main>
    </div>
  );
}
