"use client";

import { DashboardTabLink as Link } from "./DashboardTabLink";
import type { Profile } from "@/app/[locale]/dashboard/dashboard.types";
import { useLocale } from "@/context/LocaleContext";
import { dashboardHref } from "@/lib/dashboard/navigation";
import { DashboardButton, DashboardMagicCard } from "./dashboard-ui";
import { DashboardLottieScene } from "./DashboardLottieScene";

/** Shared identity message for the overview and the transfer eligibility gate. */
export function DashboardIdentityCard({ profile, motionEnabled = true }: { profile: Profile | null; motionEnabled?: boolean }) {
  const locale = useLocale(), fa = locale === "fa";
  const approved = profile?.kyc_status === "approved";
  const hasSubmittedIdentity = Boolean(profile?.document_type && profile.document_type !== "later");
  const identityReview = !approved && hasSubmittedIdentity && ["pending", "under_review"].includes(String(profile?.kyc_status));
  const identityRejected = !approved && profile?.kyc_status === "rejected";
  return <DashboardMagicCard tone={approved ? "emerald" : "amber"} replayLottieOnHover motionEnabled={motionEnabled} contentClassName="p-5 sm:p-7" data-overview-card="identity">
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
      <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-3xl border border-white/80 bg-white/70 sm:size-24"><DashboardLottieScene name={approved ? "identity-approved" : identityReview ? "compliance-review" : "identity-rejected"} size={88} motionEnabled={motionEnabled} /></span>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-xs font-semibold text-[#78572b]">{fa ? "وضعیت احراز هویت" : "Identity status"}</p>
        <h2 className="m-0! mt-1! text-xl! font-semibold leading-snug! text-[#302346]! sm:text-2xl!">{approved ? fa ? "هویت شما تأیید شده است" : "Your identity is verified" : identityReview ? fa ? "مدارک شما در حال بررسی است" : "We’re reviewing your details" : identityRejected ? fa ? "اطلاعات هویتی نیاز به اصلاح دارد" : "Your identity details need an update" : fa ? "حساب خود را برای اولین انتقال آماده کنید." : "Set up your account for your first transfer"}</h2>
        <p className="mb-0 mt-2 max-w-2xl text-sm leading-6 text-[#665876]">{approved ? fa ? "همه‌چیز آماده است؛ می‌توانید انتقال تازه‌ای ثبت کنید." : "You're all set to create a new transfer." : identityReview ? fa ? "اطلاعات شما ثبت شده و در صف بررسی است. نتیجه را همین‌جا می‌بینید." : "Your details are submitted. We'll show the outcome here." : identityRejected ? fa ? "برای ادامه، پروفایل خود را باز کنید و موارد لازم را اصلاح کنید." : "Open your profile to correct the required details." : fa ? "مشخصات شخصی و مدارک خود را برای بررسی وارد کنید. به محض اینکه آن‌ها را تأیید کنیم، می‌توانید انتقال وجه را شروع کنید." : "Enter your personal details and documents for a quick review. As soon as we approve them, you can start transferring."}</p>
      </div>
      {!approved && !identityReview && <DashboardButton className="w-full shrink-0 sm:w-auto" asChild><Link href={dashboardHref(locale, "profile")}>{identityRejected ? fa ? "اصلاح اطلاعات" : "Update details" : fa ? "تکمیل احراز هویت" : "Verify your identity"}</Link></DashboardButton>}
    </div>
  </DashboardMagicCard>;
}
