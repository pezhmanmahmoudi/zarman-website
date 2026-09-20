export type DashboardTab = "overview" | "transfer" | "recipients" | "history" | "profile" | "feedback";

export function dashboardTab(pathname: string, query: Pick<URLSearchParams, "get">): DashboardTab {
  if (/\/dashboard\/requests(?:\/|$)/.test(pathname)) return "history";
  const tab = query.get("tab");
  if (tab === "hub") return "transfer";
  if (["overview", "transfer", "recipients", "history", "profile", "feedback"].includes(tab || "")) return tab as DashboardTab;
  return query.get("requestAmountAud") || query.get("requestDirection") ? "transfer" : "overview";
}

export function dashboardHref(locale: string, tab: DashboardTab): string {
  return `/${locale === "fa" ? "fa" : "en"}/dashboard${tab === "overview" ? "" : `?tab=${tab}`}`;
}

export const dashboardCopy = {
  en: { overview: "Overview", transfer: "New transfer", recipients: "Recipients", history: "Activity", profile: "Your profile", feedback: "Feedback",
    workspace: "Your money, closer to home.", hello: "Welcome back", newTransfer: "New transfer", allActivity: "View all activity",
    account: "YOUR ZARMAN ACCOUNT", volume: "Completed transfers", volumeHint: "Total transferred · AUD", count: "Transfers completed",
    rate: "Your exchange rate", rateHint: "Indicative rate · final quote at review", attention: "Needs your attention", inProgress: "In progress",
    received: "Funds received", noAction: "No action needed", recent: "Recent activity", recentHint: "Every transfer. Every step. In one place.",
    noTransfers: "Your next connection starts here.", noTransfersHint: "Create a transfer and follow its progress from approval to arrival.",
    retry: "Try again", loading: "Loading your account…", refresh: "Refresh", verified: "Identity verified", verification: "Verify your identity",
    profileHint: "Keep your details ready for your next transfer.", signOut: "Sign out", privacy: "Hide amounts", show: "Show amounts",
    saved: "Loyalty savings", sendToIran: "Send to Iran", sendToAustralia: "Send to Australia", exchange: "Australia ↔ Iran",
    support: "A conversation, attached to your transfer.", supportHint: "Send a message from any transfer to keep your questions and updates together.",
    messages: "Open your transfers", all: "All", completed: "Completed", search: "Search code or recipient", more: "Show more",
    emptySearch: "No matching transfers", emptySearchHint: "Try another code, recipient or filter.", legacy: "Earlier transaction records",
    transferHint: "Choose your direction. Review your quote. Follow every step.", details: "Your details", review: "Review & submit",
    amounts: "Transfer amount", status: "Transfer status", skip: "Skip to dashboard content", loadError: "We couldn’t load your account. Please try again.",
    pending: "Verification in review", correction: "Verification needs attention", overviewHint: "A clear view of your transfers, from here to there.",
    refreshError: "Couldn’t refresh your account. Showing the last loaded details.",
  },
  fa: { overview: "نمای کلی", transfer: "انتقال جدید", recipients: "گیرندگان", history: "فعالیت‌ها", profile: "پروفایل شما", feedback: "بازخورد",
    workspace: "پول شما، نزدیک‌تر به خانه.", hello: "خوش آمدید", newTransfer: "انتقال جدید", allActivity: "همه فعالیت‌ها",
    account: "حساب کاربری زرمان", volume: "انتقال‌های تکمیل‌شده", volumeHint: "مجموع انتقال‌ها · دلار استرالیا", count: "انتقال تکمیل‌شده",
    rate: "نرخ اختصاصی شما", rateHint: "نرخ تقریبی · تأیید نهایی هنگام بررسی", attention: "نیازمند اقدام شما", inProgress: "در حال انجام",
    received: "وجه دریافت شد", noAction: "نیازی به اقدام شما نیست", recent: "فعالیت‌های اخیر", recentHint: "هر انتقال و هر مرحله، در یک نگاه.",
    noTransfers: "انتقال بعدی شما از اینجا شروع می‌شود.", noTransfersHint: "درخواست انتقال ثبت کنید و مسیر آن را از تأیید تا واریز دنبال کنید.",
    retry: "تلاش دوباره", loading: "در حال دریافت اطلاعات حساب…", refresh: "به‌روزرسانی", verified: "هویت تأیید شده", verification: "تکمیل احراز هویت",
    profileHint: "اطلاعات خود را برای انتقال بعدی آماده نگه دارید.", signOut: "خروج", privacy: "پنهان کردن مبالغ", show: "نمایش مبالغ",
    saved: "صرفه‌جویی وفاداری", sendToIran: "ارسال به ایران", sendToAustralia: "ارسال به استرالیا", exchange: "استرالیا ↔ ایران",
    support: "گفت‌وگویی همراه با هر انتقال.", supportHint: "پیام خود را در صفحه همان انتقال بفرستید تا پرسش‌ها و پاسخ‌ها یکجا بمانند.",
    messages: "مشاهده انتقال‌ها", all: "همه", completed: "تکمیل‌شده", search: "جستجوی کد یا نام گیرنده", more: "نمایش بیشتر",
    emptySearch: "انتقالی پیدا نشد", emptySearchHint: "کد، نام گیرنده یا فیلتر دیگری را امتحان کنید.", legacy: "سوابق تراکنش‌های پیشین",
    transferHint: "مسیر را انتخاب کنید، نرخ را بررسی کنید و هر مرحله را دنبال کنید.", details: "اطلاعات انتقال", review: "بررسی و ثبت",
    amounts: "مبلغ انتقال", status: "وضعیت انتقال", skip: "رفتن به محتوای داشبورد", loadError: "دریافت اطلاعات حساب ممکن نشد. دوباره تلاش کنید.",
    pending: "هویت در حال بررسی", correction: "احراز هویت نیازمند بررسی", overviewHint: "نمای روشن انتقال‌های شما، از مبدأ تا مقصد.",
    refreshError: "به‌روزرسانی ممکن نشد. آخرین اطلاعات دریافت‌شده نمایش داده می‌شود.",
  },
} as const;
