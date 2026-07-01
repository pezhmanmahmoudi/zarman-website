// lib/treasury-utils.ts
import s from "@/styles/admin/Treasury.module.css";

// ── Persian strings ────────────────────────────────────────────────────────
export const FA = {
  pageTitle: "خزانه‌داری و استراتژی",
  pageDesc: "نمای زنده از وضعیت مالی، موجودی کشوها، و تحلیل ریسک صرافی.",
  noAlerts:  "هیچ هشدار فعالی وجود ندارد.",

  warnBannerTitle: "هشدارهای داده‌ای حسابداری",
  warnBannerHint:  "نمایش جزئیات ▾",
  warnUnit: "هشدار",

  sec1: "مرکز استراتژی",
  sec1Desc: "توصیهٔ عملیاتی و امتیاز سلامت کسب‌وکار",
  sec2: "بازار و موجودی",
  sec2Desc: "وضعیت ذخیره دلار و تطابق با محدوده هدف",
  sec3: "نقدینگی و حساب‌ها",
  sec3Desc: "موجودی حساب‌های ایران و معیار Cash Runway",
  secExposure: "مواجهه ارزی",
  secExposureDesc: "نسبت دارایی دلار به کل سبد — بهای تمام‌شده و بازار",
  sec4: "سودآوری",
  sec4Desc: "آبشار سود عملیاتی از معاملات تا سود خالص",
  sec5: "سرمایه مالک",
  sec5Desc: "وام‌ها، تزریق سرمایه و ارزش صافی کسب‌وکار",
  secSettings: "تنظیمات خزانه‌داری",
  secSettingsDesc: "پارامترهای محدوده، هدف و حساسیت توصیه",
  secRecon: "وضعیت زنده کشوها و حساب‌ها",
  secReconDesc: "محاسبه خودکار موجودی بانک‌ها، حساب‌های مجازی و وجوه در راه بر اساس لجر دوبل.",
  
  recLabel:   "توصیه",
  inactionLabel: "ریسک عدم اقدام",
  actionLabel:   "اقدام پیشنهادی",
  drivingLabel:  "شاخص‌های محرک",
  confLabel:  "اطمینان",

  BUY_AUD:  "خرید دلار",
  SELL_AUD: "فروش دلار",
  HOLD:     "نگه‌داری",
  CAUTION:  "احتیاط",

  riskLow:      "پایین",
  riskModerate: "متوسط",
  riskElevated: "بالا",
  riskHigh:     "زیاد",
  riskCritical: "بحرانی",

  healthLabel:    "امتیاز سلامت",
  breakdownLabel: "جزئیات امتیاز",
  catExcellent:   "ممتاز",
  catGood:        "خوب",
  catCaution:     "احتیاط",
  catCritical:    "بحرانی",
  scoreInventory:    "موجودی",
  scoreLiquidity:    "نقدینگی",
  scoreExposure:     "مواجهه",
  scoreProfitability:"سودآوری",
  scoreForecast:     "پیش‌بینی",
  
  trendImproving: "در حال بهبود ↗",
  trendStable:    "پایدار →",
  trendDeclining: "در حال کاهش ↘",

  rateAdjTitle:      "پیشنهاد تنظیم نرخ",
  rateAdjBuyLabel:   "نرخ خرید",
  rateAdjSellLabel:  "نرخ فروش",
  rateAdjNoChange:   "بدون تغییر",
  rateAdjToman:      "تومان",
  rateAdjDisclaimer: "صرفاً بر اساس موجودی و نقدینگی — پیش‌بینی نرخ ارز در آن وجود ندارد.",

  forecastTitle:  "پیش‌بینی موجودی",
  forecastDesc:   "بر اساس سرعت معاملات فعلی",
  v7Label:        "سرعت ۷ روزه",
  v30Label:       "سرعت ۳۰ روزه",
  vBuyLabel:      "سرعت خرید ۳۰د",
  vNetLabel:      "سرعت خالص",
  covLabel:       "پوشش روزانه",
  depletionLabel: "تاریخ تخمین",
  forecastNA: "داده کافی برای پیش‌بینی وجود ندارد.",

  currentRate:    "نرخ خرید فعلی",
  audInventory:   "موجودی دلار",
  invTarget:      "هدف موجودی",
  invGap:         "شکاف",
  wac:            "میانگین وزنی (WAC)",
  invRatio:       "نسبت موجودی",
  coverageDays:   "پوشش روزانه",
  invDetailTitle: "جزئیات موجودی ▾",
  invCostVal:     "ارزش (بهای تمام‌شده)",
  invMarketVal:   "ارزش (بازار)",
  invValDiff:     "اختلاف ارزش‌گذاری",
  invGapPct:      "درصد شکاف",

  totalLiquidity: "کل نقدینگی ایران",
  netBV:          "ارزش صافی کسب‌وکار",
  cashRunwayLiquid: "Cash Runway (نقد)",
  cashRunwayTotal:  "Cash Runway (شامل موجودی)",
  runwayDetailTitle: "جزئیات Runway ▾",
  daysUnit:       "روز",
  monthsUnit:     "ماه",

  exposureMarket: "مواجهه (بازار)",
  exposureCost:   "مواجهه (بهای تمام‌شده)",
  
  operatingProfit:"سود عملیاتی",
  unrealizedPL:   "سود/زیان دفتری",
  totalProfit:    "سود خالص کل",

  loanBalance:    "مانده وام مالک",

  na: "N/A",

  hintWacProfit:       "سود هر دلار:",
  hintValDiff:         "بازار − بهای تمام‌شده",
  hintRelToTarget:     "نسبت به هدف",
  hintMinLiq:          "حداقل:",
  hintTarget:          "هدف:",
  hintMax:             "حداکثر:",
  hintLiquidOnly:      "فقط از نقدینگی ایران",
  hintCashPlusInv:     "نقد + فروش کل موجودی",
  hintExposureCost:    "بر اساس WAC (بهای تمام‌شده)",
  settingsBody1:       "تغییر پارامترها بر توصیه‌های آینده تأثیر می‌گذارد. صفحه بعد از ذخیره به‌روز می‌شود.",
  settingsBody2:       "فرم تنظیمات در مرحله بعدی اضافه می‌شود.",
  hintCurrentRate:     "نرخ فعلی خرید دلار توسط کسب‌وکار",
  hintOperatingProfit: "تجاری + کارمزد − هزینه‌ها",
  hintUnrealizedPL:    "تا فروش، فقط روی کاغذ است.",
  hintTotalProfit:     "عملیاتی + سود/زیان دفتری",
  hintOwnerLoan:       "مجموع تزریق مالک − بازپرداخت‌ها",
  hintNetBV:           "= کل دارایی − وام مالک",

  hintV7: "میانگین فروش روزانه دلار در ۷ روز گذشته",
  hintV30: "میانگین فروش روزانه دلار در ۳۰ روز گذشته",
  hintVBuy: "میانگین خرید (شارژ انبار) روزانه در ۳۰ روز گذشته",
  hintVNet: "تفاضل خرید و فروش. منفی یعنی انبار در حال کاهش است.",
  hintCov: "تعداد روزهایی که با سرعت فروش فعلی، انبار دلار دوام می‌آورد.",
  hintDepletion: "تاریخ تخمینی صفر شدن کامل انبار دلار.",
};

// ── CSS class helpers ──────────────────────────────────────────────────────
export function recCardCls(action: string) {
  if (action === "BUY_AUD")  return s.recBuyAUD;
  if (action === "SELL_AUD") return s.recSellAUD;
  if (action === "HOLD")     return s.recHold;
  return s.recCaution;
}

export function recBadgeCls(action: string) {
  if (action === "BUY_AUD")  return s.badgeBuyAUD;
  if (action === "SELL_AUD") return s.badgeSellAUD;
  if (action === "HOLD")     return s.badgeHold;
  return s.badgeCaution;
}

export function riskCls(level: string) {
  if (level === "low")      return s.riskLow;
  if (level === "moderate") return s.riskModerate;
  if (level === "elevated") return s.riskElevated;
  if (level === "high")     return s.riskHigh;
  return s.riskCritical;
}

export function riskFA(level: string) {
  if (level === "low")      return FA.riskLow;
  if (level === "moderate") return FA.riskModerate;
  if (level === "elevated") return FA.riskElevated;
  if (level === "high")     return FA.riskHigh;
  return FA.riskCritical;
}

export function scoreCircleCls(cat: string) {
  if (cat === "excellent") return s.scoreExcellent;
  if (cat === "good")      return s.scoreGood;
  if (cat === "caution")   return s.scoreCaution;
  return s.scoreCritical;
}

export function scoreNumCls(cat: string) {
  if (cat === "excellent") return s.numExcellent;
  if (cat === "good")      return s.numGood;
  if (cat === "caution")   return s.numCaution;
  return s.numCritical;
}

export function catBadgeCls(cat: string) {
  if (cat === "excellent") return s.catExcellent;
  if (cat === "good")      return s.catGood;
  if (cat === "caution")   return s.catCaution;
  return s.catCritical;
}

export function catFA(cat: string) {
  if (cat === "excellent") return FA.catExcellent;
  if (cat === "good")      return FA.catGood;
  if (cat === "caution")   return FA.catCaution;
  return FA.catCritical;
}

export function scoreBarColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

export function pct(v: number, decimals = 1) {
  return (v * 100).toFixed(decimals) + "%";
}

export function fmtMonths(m: number | null): string {
  if (m === null) return FA.na;
  return m.toFixed(1) + " " + FA.monthsUnit;
}

export function fmtDays(d: number | null): string {
  if (d === null) return FA.na;
  return Math.round(d) + " " + FA.daysUnit;
}

export function trendBadgeCls(t: string) {
  if (t === "improving") return s.trendImproving;
  if (t === "declining") return s.trendDeclining;
  return s.trendStable;
}

export function trendFA(t: string) {
  if (t === "improving") return FA.trendImproving;
  if (t === "declining") return FA.trendDeclining;
  return FA.trendStable;
}

export function exposureCardCls(ratio: number, target: number, max: number): string {
  if (ratio > max)             return s.exposureCardDanger;
  if (ratio > max * 0.85)      return s.exposureCardWarn;
  if (Math.abs(ratio - target) < 0.05) return s.exposureCardOk;
  return s.exposureCardNeutral;
}

export function inventoryBorderCls(inventory: number, min: number, max: number): string {
  if (inventory < min) return s.inventoryHeroCritical;
  if (inventory > max) return s.inventoryHeroWarning;
  return s.inventoryHeroOk;
}