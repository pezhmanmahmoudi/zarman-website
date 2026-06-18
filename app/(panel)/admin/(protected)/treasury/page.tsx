import React from "react";
import {
  TrendingUp, TrendingDown, AlertTriangle, AlertCircle, Info,
  DollarSign, Activity, BarChart2, Scale,
  ArrowDownCircle, ArrowUpCircle, Clock, Percent,
  Coins, CreditCard, ShieldCheck,
  Calendar, Minus, RefreshCw, Settings, ArrowRight,
} from "lucide-react";

import { getTreasuryFullData } from "@/app/actions/treasury.actions";
import AccountBalanceForm from "@/components/admin/treasury/AccountBalanceForm";
import OwnerLoanForm      from "@/components/admin/treasury/OwnerLoanForm";
import ExpenseForm        from "@/components/admin/treasury/ExpenseForm";
import { fmtIRT, fmtAUD, fmtRate } from "@/lib/accounting-engine";

import shellStyles from "@/styles/admin/AdminShell.module.css";
import cardStyles  from "@/styles/admin/AdminCards.module.css";
import s           from "@/styles/admin/Treasury.module.css";

export const metadata = { title: "Treasury | Zarman Admin" };
export const revalidate = 60;

// ── Persian strings ────────────────────────────────────────────────────────
const FA = {
  pageTitle: "\u062e\u0632\u0627\u0646\u0647\u200c\u062f\u0627\u0631\u06cc \u0648 \u0627\u0633\u062a\u0631\u0627\u062a\u0698\u06cc",
  pageDesc:  "\u0645\u0631\u06a9\u0632 \u062a\u062d\u0644\u06cc\u0644 \u062e\u0632\u0627\u0646\u0647\u060c \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0648 \u062a\u0635\u0645\u06cc\u0645\u200c\u06af\u06cc\u0631\u06cc",
  noAlerts:  "\u0647\u06cc\u0686 \u0647\u0634\u062f\u0627\u0631 \u0641\u0639\u0627\u0644\u06cc \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.",

  // Accounting warnings banner
  warnBannerTitle: "\u0647\u0634\u062f\u0627\u0631\u0647\u0627\u06cc \u062f\u0627\u062f\u0647\u200c\u0627\u06cc \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc",
  warnBannerHint:  "\u0646\u0645\u0627\u06cc\u0634 \u062c\u0632\u0626\u06cc\u0627\u062a \u25be",
  warnUnit: "\u0647\u0634\u062f\u0627\u0631",

  // Section headers
  sec1: "\u0645\u0631\u06a9\u0632 \u0627\u0633\u062a\u0631\u0627\u062a\u0698\u06cc",
  sec1Desc: "\u062a\u0648\u0635\u06cc\u0647\u0654 \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc \u0648 \u0627\u0645\u062a\u06cc\u0627\u0632 \u0633\u0644\u0627\u0645\u062a \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631",
  sec2: "\u0628\u0627\u0632\u0627\u0631 \u0648 \u0645\u0648\u062c\u0648\u062f\u06cc",
  sec2Desc: "\u0648\u0636\u0639\u06cc\u062a \u0630\u062e\u06cc\u0631\u0647 \u062f\u0644\u0627\u0631 \u0648 \u062a\u0637\u0627\u0628\u0642 \u0628\u0627 \u0645\u062d\u062f\u0648\u062f\u0647 \u0647\u062f\u0641",
  sec3: "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0648 \u062d\u0633\u0627\u0628\u200c\u0647\u0627",
  sec3Desc: "\u0645\u0648\u062c\u0648\u062f\u06cc \u062d\u0633\u0627\u0628\u200c\u0647\u0627\u06cc \u0627\u06cc\u0631\u0627\u0646 \u0648 \u0645\u0639\u06cc\u0627\u0631 Cash Runway",
  secExposure: "\u0645\u0648\u0627\u062c\u0647\u0647 \u0627\u0631\u0632\u06cc",
  secExposureDesc: "\u0646\u0633\u0628\u062a \u062f\u0627\u0631\u0627\u06cc\u06cc \u062f\u0644\u0627\u0631 \u0628\u0647 \u06a9\u0644 \u0633\u0628\u062f \u2014 \u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647 \u0648 \u0628\u0627\u0632\u0627\u0631",
  sec4: "\u0633\u0648\u062f\u0622\u0648\u0631\u06cc",
  sec4Desc: "\u0622\u0628\u0634\u0627\u0631 \u0633\u0648\u062f \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc \u0627\u0632 \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u062a\u0627 \u0633\u0648\u062f \u062e\u0627\u0644\u0635",
  sec5: "\u0633\u0631\u0645\u0627\u06cc\u0647 \u0645\u0627\u0644\u06a9",
  sec5Desc: "\u0648\u0627\u0645\u200c\u0647\u0627\u060c \u062a\u0632\u0631\u06cc\u0642 \u0633\u0631\u0645\u0627\u06cc\u0647 \u0648 \u0627\u0631\u0632\u0634 \u0635\u0627\u0641\u06cc \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631",
  secSettings: "\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u062e\u0632\u0627\u0646\u0647\u200c\u062f\u0627\u0631\u06cc",
  secSettingsDesc: "\u067e\u0627\u0631\u0627\u0645\u062a\u0631\u0647\u0627\u06cc \u0645\u062d\u062f\u0648\u062f\u0647\u060c \u0647\u062f\u0641 \u0648 \u062d\u0633\u0627\u0633\u06cc\u062a \u062a\u0648\u0635\u06cc\u0647",
  secRecon: "\u062a\u0637\u0628\u06cc\u0642 \u062d\u0633\u0627\u0628\u200c\u0647\u0627",
  secReconDesc: "\u062a\u0637\u0627\u0628\u0642 \u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647 \u0628\u0627 \u0645\u0648\u062c\u0648\u062f\u06cc \u0648\u0627\u0642\u0639\u06cc \u062d\u0633\u0627\u0628",
  reconComingSoon: "\u0628\u0647 \u0632\u0648\u062f\u06cc \u0627\u0636\u0627\u0641\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f",
  reconComingSoonBody: "\u0627\u06cc\u0646 \u0628\u062e\u0634 \u0627\u0645\u06a9\u0627\u0646 \u062a\u0637\u0628\u06cc\u0642 \u062f\u0633\u062a\u06cc \u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647 \u0628\u0627 \u0645\u0648\u062c\u0648\u062f\u06cc \u0648\u0627\u0642\u0639\u06cc \u062d\u0633\u0627\u0628 \u0631\u0627 \u0641\u0631\u0627\u0647\u0645 \u0645\u06cc\u200c\u06a9\u0646\u062f.",

  // Recommendation fields
  recLabel:   "\u062a\u0648\u0635\u06cc\u0647",
  riskLabel:  "\u0633\u0637\u062d \u0631\u06cc\u0633\u06a9",
  confLabel:  "\u0627\u0637\u0645\u06cc\u0646\u0627\u0646",
  reasonLabel:   "\u062a\u062d\u0644\u06cc\u0644 \u0648\u0636\u0639\u06cc\u062a",
  inactionLabel: "\u0631\u06cc\u0633\u06a9 \u0639\u062f\u0645 \u0627\u0642\u062f\u0627\u0645",
  actionLabel:   "\u0627\u0642\u062f\u0627\u0645 \u067e\u06cc\u0634\u0646\u0647\u0627\u062f\u06cc",
  drivingLabel:  "\u0634\u0627\u062e\u0635\u200c\u0647\u0627\u06cc \u0645\u062d\u0631\u06a9",

  // Action labels
  BUY_AUD:  "\u062e\u0631\u06cc\u062f \u062f\u0644\u0627\u0631",
  SELL_AUD: "\u0641\u0631\u0648\u0634 \u062f\u0644\u0627\u0631",
  HOLD:     "\u0646\u06af\u0647\u200c\u062f\u0627\u0631\u06cc",
  CAUTION:  "\u0627\u062d\u062a\u06cc\u0627\u0637",

  // Risk labels
  riskLow:      "\u067e\u0627\u06cc\u06cc\u0646",
  riskModerate: "\u0645\u062a\u0648\u0633\u0637",
  riskElevated: "\u0628\u0627\u0644\u0627",
  riskHigh:     "\u0632\u06cc\u0627\u062f",
  riskCritical: "\u0628\u062d\u0631\u0627\u0646\u06cc",

  // Health score
  healthLabel:    "\u0627\u0645\u062a\u06cc\u0627\u0632 \u0633\u0644\u0627\u0645\u062a",
  breakdownLabel: "\u062c\u0632\u0626\u06cc\u0627\u062a \u0627\u0645\u062a\u06cc\u0627\u0632",
  catExcellent:   "\u0645\u0645\u062a\u0627\u0632",
  catGood:        "\u062e\u0648\u0628",
  catCaution:     "\u0627\u062d\u062a\u06cc\u0627\u0637",
  catCritical:    "\u0628\u062d\u0631\u0627\u0646\u06cc",
  scoreInventory:    "\u0645\u0648\u062c\u0648\u062f\u06cc",
  scoreLiquidity:    "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc",
  scoreExposure:     "\u0645\u0648\u0627\u062c\u0647\u0647",
  scoreProfitability:"\u0633\u0648\u062f\u0622\u0648\u0631\u06cc",
  scoreForecast:     "\u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc",
  trendImproving: "\u062f\u0631 \u062d\u0627\u0644 \u0628\u0647\u0628\u0648\u062f \u2197",
  trendStable:    "\u067e\u0627\u06cc\u062f\u0627\u0631 \u2192",
  trendDeclining: "\u062f\u0631 \u062d\u0627\u0644 \u06a9\u0627\u0647\u0634 \u2198",

  // Rate adjustment
  rateAdjTitle:      "\u067e\u06cc\u0634\u0646\u0647\u0627\u062f \u062a\u0646\u0638\u06cc\u0645 \u0646\u0631\u062e",
  rateAdjBuyLabel:   "\u0646\u0631\u062e \u062e\u0631\u06cc\u062f",
  rateAdjSellLabel:  "\u0646\u0631\u062e \u0641\u0631\u0648\u0634",
  rateAdjNoChange:   "\u0628\u062f\u0648\u0646 \u062a\u063a\u06cc\u06cc\u0631",
  rateAdjToman:      "\u062a\u0648\u0645\u0627\u0646",
  rateAdjDisclaimer: "\u0635\u0631\u0641\u0627\u064b \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u0648\u062c\u0648\u062f\u06cc \u0648 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u2014 \u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc \u0646\u0631\u062e \u0627\u0631\u0632 \u062f\u0631 \u0622\u0646 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.",

  // Forecast
  forecastTitle:  "\u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc \u0645\u0648\u062c\u0648\u062f\u06cc",
  forecastDesc:   "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0633\u0631\u0639\u062a \u0645\u0639\u0627\u0645\u0644\u0627\u062a \u0641\u0639\u0644\u06cc",
  v7Label:        "\u0633\u0631\u0639\u062a \u06f7 \u0631\u0648\u0632\u0647",
  v30Label:       "\u0633\u0631\u0639\u062a \u06f3\u06f0 \u0631\u0648\u0632\u0647",
  vBuyLabel:      "\u0633\u0631\u0639\u062a \u062e\u0631\u06cc\u062f \u06f3\u06f0\u062f",
  vNetLabel:      "\u0633\u0631\u0639\u062a \u062e\u0627\u0644\u0635",
  covLabel:       "\u067e\u0648\u0634\u0634 \u0631\u0648\u0632\u0627\u0646\u0647",
  depletionLabel: "\u062a\u0627\u0631\u06cc\u062e \u062a\u062e\u0645\u06cc\u0646",
  forecastNA: "\u062f\u0627\u062f\u0647 \u06a9\u0627\u0641\u06cc \u0628\u0631\u0627\u06cc \u067e\u06cc\u0634\u200c\u0628\u06cc\u0646\u06cc \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.",

  // Section 2 metric labels
  currentRate:    "\u0646\u0631\u062e \u062e\u0631\u06cc\u062f \u0641\u0639\u0644\u06cc",
  audInventory:   "\u0645\u0648\u062c\u0648\u062f\u06cc \u062f\u0644\u0627\u0631",
  invTarget:      "\u0647\u062f\u0641 \u0645\u0648\u062c\u0648\u062f\u06cc",
  invGap:         "\u0634\u06a9\u0627\u0641",
  wac:            "\u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0648\u0632\u0646\u06cc (WAC)",
  invRatio:       "\u0646\u0633\u0628\u062a \u0645\u0648\u062c\u0648\u062f\u06cc",
  coverageDays:   "\u067e\u0648\u0634\u0634 \u0631\u0648\u0632\u0627\u0646\u0647",
  invDetailTitle: "\u062c\u0632\u0626\u06cc\u0627\u062a \u0645\u0648\u062c\u0648\u062f\u06cc \u25be",
  invCostVal:     "\u0627\u0631\u0632\u0634 (\u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647)",
  invMarketVal:   "\u0627\u0631\u0632\u0634 (\u0628\u0627\u0632\u0627\u0631)",
  invValDiff:     "\u0627\u062e\u062a\u0644\u0627\u0641 \u0627\u0631\u0632\u0634\u200c\u06af\u0630\u0627\u0631\u06cc",
  invGapPct:      "\u062f\u0631\u0635\u062f \u0634\u06a9\u0627\u0641",

  // Section 3 metric labels
  totalLiquidity: "\u06a9\u0644 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0627\u06cc\u0631\u0627\u0646",
  kadoosBalance:  "\u0645\u0648\u062c\u0648\u062f\u06cc \u06a9\u0627\u062f\u0648\u0633",
  pezhmanBalance: "\u0645\u0648\u062c\u0648\u062f\u06cc \u067e\u0698\u0645\u0627\u0646",
  netBV:          "\u0627\u0631\u0632\u0634 \u0635\u0627\u0641\u06cc \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631",
  cashRunway:     "Cash Runway",
  cashRunwayLiquid: "Cash Runway (\u0646\u0642\u062f)",
  cashRunwayTotal:  "Cash Runway (\u0634\u0627\u0645\u0644 \u0645\u0648\u062c\u0648\u062f\u06cc)",
  runwayDetailTitle: "\u062c\u0632\u0626\u06cc\u0627\u062a Runway \u25be",
  avgMonthlyExp:  "\u0645\u06cc\u0627\u0646\u06af\u06cc\u0646 \u0647\u0632\u06cc\u0646\u0647 \u0645\u0627\u0647\u0627\u0646\u0647",
  daysUnit:       "\u0631\u0648\u0632",
  monthsUnit:     "\u0645\u0627\u0647",

  // Section Exposure
  exposureMarket: "\u0645\u0648\u0627\u062c\u0647\u0647 (\u0628\u0627\u0632\u0627\u0631)",
  exposureCost:   "\u0645\u0648\u0627\u062c\u0647\u0647 (\u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647)",
  exposureTarget: "\u0647\u062f\u0641 \u0645\u0648\u0627\u062c\u0647\u0647",
  exposureMax:    "\u062d\u062f\u0627\u06a9\u062b\u0631 \u0645\u0648\u0627\u062c\u0647\u0647",

  // Section 4 metric labels
  realizedProfit: "\u0633\u0648\u062f \u062a\u062c\u0627\u0631\u06cc \u0628\u0633\u062a\u0647\u200c\u0634\u062f\u0647",
  feeIncome:      "\u062f\u0631\u0622\u0645\u062f \u06a9\u0627\u0631\u0645\u0632\u062f",
  paidExpenses:   "\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u067e\u0631\u062f\u0627\u062e\u062a\u200c\u0634\u062f\u0647",
  operatingProfit:"\u0633\u0648\u062f \u0639\u0645\u0644\u06cc\u0627\u062a\u06cc",
  unrealizedPL:   "\u0633\u0648\u062f/\u0632\u06cc\u0627\u0646 \u062f\u0641\u062a\u0631\u06cc",
  totalProfit:    "\u0633\u0648\u062f \u062e\u0627\u0644\u0635 \u06a9\u0644",
  expensesPanel:  "\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u062b\u0628\u062a\u200c\u0634\u062f\u0647",

  // Section 5 metric labels
  loanBalance:    "\u0645\u0627\u0646\u062f\u0647 \u0648\u0627\u0645 \u0645\u0627\u0644\u06a9",
  totalAssets:    "\u0627\u0631\u0632\u0634 \u06a9\u0644 \u062f\u0627\u0631\u0627\u06cc\u06cc",
  loansPanel:     "\u0633\u0648\u0627\u0628\u0642 \u0648\u0627\u0645 \u0645\u0627\u0644\u06a9",

  na: "N/A",
  pending: "\u0645\u0639\u0644\u0642",

  // Hint strings — always reference as {FA.xxx} in JSX, never as raw JSX text
  hintWacProfit:       "\u0633\u0648\u062f \u0647\u0631 \u062f\u0644\u0627\u0631:",
  hintValDiff:         "\u0628\u0627\u0632\u0627\u0631 \u2212 \u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647",
  hintRelToTarget:     "\u0646\u0633\u0628\u062a \u0628\u0647 \u0647\u062f\u0641",
  hintMinLiq:          "\u062d\u062f\u0627\u0642\u0644:",
  hintTarget:          "\u0647\u062f\u0641:",
  hintMax:             "\u062d\u062f\u0627\u06a9\u062b\u0631:",
  hintLiquidOnly:      "\u0641\u0642\u0637 \u0627\u0632 \u0646\u0642\u062f\u06cc\u0646\u06af\u06cc \u0627\u06cc\u0631\u0627\u0646",
  hintCashPlusInv:     "\u0646\u0642\u062f + \u0641\u0631\u0648\u0634 \u06a9\u0644 \u0645\u0648\u062c\u0648\u062f\u06cc",
  hintExposureCost:    "\u0628\u0631 \u0627\u0633\u0627\u0633 WAC (\u0628\u0647\u0627\u06cc \u062a\u0645\u0627\u0645\u200c\u0634\u062f\u0647)",
  hintExpTarget:       "\u062a\u0646\u0638\u06cc\u0645\u200c\u067e\u0630\u06cc\u0631 \u062f\u0631 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u062e\u0632\u0627\u0646\u0647",
  hintExpMax:          "\u0633\u0642\u0641 \u0645\u062c\u0627\u0632 \u0645\u0648\u0627\u062c\u0647\u0647",
  settingsBody1:       "\u062a\u063a\u06cc\u06cc\u0631 \u067e\u0627\u0631\u0627\u0645\u062a\u0631\u0647\u0627 \u0628\u0631 \u062a\u0648\u0635\u06cc\u0647\u200c\u0647\u0627\u06cc \u0622\u06cc\u0646\u062f\u0647 \u062a\u0623\u062b\u06cc\u0631 \u0645\u06cc\u200c\u06af\u0630\u0627\u0631\u062f. \u0635\u0641\u062d\u0647 \u0628\u0639\u062f \u0627\u0632 \u0630\u062e\u06cc\u0631\u0647 \u0628\u0647\u200c\u0631\u0648\u0632 \u0645\u06cc\u200c\u0634\u0648\u062f.",
  settingsBody2:       "\u0641\u0631\u0645 \u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u062f\u0631 \u0645\u0631\u062d\u0644\u0647 \u0628\u0639\u062f\u06cc \u0627\u0636\u0627\u0641\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.",
  hintCurrentRate:     "\u0646\u0631\u062e \u0641\u0639\u0644\u06cc \u062e\u0631\u06cc\u062f \u062f\u0644\u0627\u0631 \u062a\u0648\u0633\u0637 \u06a9\u0633\u0628\u200c\u0648\u06a9\u0627\u0631",
  hintRealizedProfit:  "\u0633\u0648\u062f \u0648\u0627\u0642\u0639\u06cc = \u0645\u0628\u0644\u063a \u062f\u0631\u06cc\u0627\u0641\u062a\u06cc \u2212 (\u062a\u0639\u062f\u0627\u062f \u00d7 WAC)",
  hintFeeIncome:       "\u062f\u0631\u0622\u0645\u062f \u0627\u0632 \u06a9\u0627\u0631\u0645\u0632\u062f \u0645\u0639\u0627\u0645\u0644\u0627\u062a",
  hintOperatingProfit: "\u062a\u062c\u0627\u0631\u06cc + \u06a9\u0627\u0631\u0645\u0632\u062f \u2212 \u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627",
  hintUnrealizedPL:    "\u062a\u0627 \u0641\u0631\u0648\u0634\u060c \u0641\u0642\u0637 \u0631\u0648\u06cc \u06a9\u0627\u063a\u0630 \u0627\u0633\u062a.",
  hintTotalProfit:     "\u0639\u0645\u0644\u06cc\u0627\u062a\u06cc + \u0633\u0648\u062f/\u0632\u06cc\u0627\u0646 \u062f\u0641\u062a\u0631\u06cc",
  hintOwnerLoan:       "\u0645\u062c\u0645\u0648\u0639 \u062a\u0632\u0631\u06cc\u0642 \u0645\u0627\u0644\u06a9 \u2212 \u0628\u0627\u0632\u067e\u0631\u062f\u0627\u062e\u062a\u200c\u0647\u0627",
  hintTotalAssets:     "\u0646\u0642\u062f\u06cc\u0646\u06af\u06cc + \u0627\u0631\u0632\u0634 \u0628\u0627\u0632\u0627\u0631 \u0645\u0648\u062c\u0648\u062f\u06cc",
  hintNetBV:           "= \u06a9\u0644 \u062f\u0627\u0631\u0627\u06cc\u06cc \u2212 \u0648\u0627\u0645 \u0645\u0627\u0644\u06a9",
};

// ── CSS class helpers ──────────────────────────────────────────────────────

function recCardCls(action: string) {
  if (action === "BUY_AUD")  return s.recBuyAUD;
  if (action === "SELL_AUD") return s.recSellAUD;
  if (action === "HOLD")     return s.recHold;
  return s.recCaution;
}

function recBadgeCls(action: string) {
  if (action === "BUY_AUD")  return s.badgeBuyAUD;
  if (action === "SELL_AUD") return s.badgeSellAUD;
  if (action === "HOLD")     return s.badgeHold;
  return s.badgeCaution;
}

function riskCls(level: string) {
  if (level === "low")      return s.riskLow;
  if (level === "moderate") return s.riskModerate;
  if (level === "elevated") return s.riskElevated;
  if (level === "high")     return s.riskHigh;
  return s.riskCritical;
}

function riskFA(level: string) {
  if (level === "low")      return FA.riskLow;
  if (level === "moderate") return FA.riskModerate;
  if (level === "elevated") return FA.riskElevated;
  if (level === "high")     return FA.riskHigh;
  return FA.riskCritical;
}

function scoreCircleCls(cat: string) {
  if (cat === "excellent") return s.scoreExcellent;
  if (cat === "good")      return s.scoreGood;
  if (cat === "caution")   return s.scoreCaution;
  return s.scoreCritical;
}

function scoreNumCls(cat: string) {
  if (cat === "excellent") return s.numExcellent;
  if (cat === "good")      return s.numGood;
  if (cat === "caution")   return s.numCaution;
  return s.numCritical;
}

function catBadgeCls(cat: string) {
  if (cat === "excellent") return s.catExcellent;
  if (cat === "good")      return s.catGood;
  if (cat === "caution")   return s.catCaution;
  return s.catCritical;
}

function catFA(cat: string) {
  if (cat === "excellent") return FA.catExcellent;
  if (cat === "good")      return FA.catGood;
  if (cat === "caution")   return FA.catCaution;
  return FA.catCritical;
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function alertItemCls(severity: string) {
  if (severity === "critical") return `${s.alertItem} ${s.alertItemCritical}`;
  if (severity === "warning")  return `${s.alertItem} ${s.alertItemWarning}`;
  return `${s.alertItem} ${s.alertItemInfo}`;
}
function alertIconCls(severity: string) {
  if (severity === "critical") return s.alertIconCritical;
  if (severity === "warning")  return s.alertIconWarning;
  return s.alertIconInfo;
}
function alertTitleCls(severity: string) {
  if (severity === "critical") return `${s.alertTitle} ${s.alertTitleCritical}`;
  if (severity === "warning")  return `${s.alertTitle} ${s.alertTitleWarning}`;
  return `${s.alertTitle} ${s.alertTitleInfo}`;
}

function pct(v: number, decimals = 1) {
  return (v * 100).toFixed(decimals) + "%";
}

function fmtMonths(m: number | null): string {
  if (m === null) return FA.na;
  return m.toFixed(1) + " " + FA.monthsUnit;
}

function fmtDays(d: number | null): string {
  if (d === null) return FA.na;
  return Math.round(d) + " " + FA.daysUnit;
}

function trendBadgeCls(t: string) {
  if (t === "improving") return s.trendImproving;
  if (t === "declining") return s.trendDeclining;
  return s.trendStable;
}

function trendFA(t: string) {
  if (t === "improving") return FA.trendImproving;
  if (t === "declining") return FA.trendDeclining;
  return FA.trendStable;
}

function exposureCardCls(ratio: number, target: number, max: number): string {
  if (ratio > max)             return s.exposureCardDanger;
  if (ratio > max * 0.85)      return s.exposureCardWarn;
  if (Math.abs(ratio - target) < 0.05) return s.exposureCardOk;
  return s.exposureCardNeutral;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function TreasuryPage() {
  const { accounting, treasury, strategy, ownerLoans, expenses, settings } =
    await getTreasuryFullData();

  const {
    recommendation: rec,
    healthScore: hs,
    alerts,
    criticalAlertCount,
    rateAdjustmentSuggestion: rateAdj,
    trendAnalysis: trend,
    accountingWarnings,
  } = strategy;
  const a = accounting;
  const t = treasury;

  const breakdownItems = [
    { label: FA.scoreInventory,     score: hs.breakdown.inventory,     weight: "30%" },
    { label: FA.scoreLiquidity,     score: hs.breakdown.liquidity,     weight: "25%" },
    { label: FA.scoreExposure,      score: hs.breakdown.exposure,      weight: "20%" },
    { label: FA.scoreProfitability, score: hs.breakdown.profitability, weight: "15%" },
    { label: FA.scoreForecast,      score: hs.breakdown.forecast,      weight: "10%" },
  ];

  return (
    <>
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className={shellStyles.topBar}>
        <div>
          <h1 className={shellStyles.pageTitle}>{FA.pageTitle}</h1>
        </div>
        <div className={shellStyles.topBarActions}>
          {criticalAlertCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.375rem",
              padding: "0.375rem 0.875rem", borderRadius: "100px",
              background: "rgba(239,68,68,0.12)", color: "#dc2626",
              fontSize: "0.8rem", fontWeight: 700,
            }}>
              <AlertTriangle size={14} />
              {criticalAlertCount} {FA.riskCritical}
            </span>
          )}
          {accountingWarnings.length > 0 && (
            <span className={s.warnCountBadge}>
              <AlertCircle size={14} />
              {accountingWarnings.length} {FA.warnUnit}
            </span>
          )}
        </div>
      </div>

      <div className={shellStyles.pageContent} style={{ fontFamily: "var(--font-fa-content)" }}>

        {/* ══════════════════════════════════════════════════════════
            ZONE A: ACCOUNTING WARNINGS (always above KPIs)
            ══════════════════════════════════════════════════════════ */}
        {accountingWarnings.length > 0 && (
          <details className={s.warnBanner}>
            <summary className={s.warnBannerSummary}>
              <AlertCircle size={16} color="#b45309" />
              <span className={s.warnBannerTitle}>{FA.warnBannerTitle}</span>
              <span className={s.warnBannerCount}>{accountingWarnings.length} {FA.warnUnit}</span>
              <span className={s.warnBannerToggle}>{FA.warnBannerHint}</span>
            </summary>
            <div className={s.warnBannerList}>
              {accountingWarnings.map((w, i) => {
                const isCritical = w.includes("\u0645\u0646\u0641\u06cc \u0634\u062f") || w.includes("negative");
                return (
                  <div key={i} className={`${s.warnBannerItem} ${isCritical ? s.warnBannerItemCritical : ""}`}>
                    <span style={{ flexShrink: 0, marginTop: "2px" }}>
                      {isCritical ? "🔴" : "•"}
                    </span>
                    <span>{w}</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* ══════════════════════════════════════════════════════════
            ZONE B: ACTIVE ALERTS BANNER
            ══════════════════════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div className={s.alertBanner}>
            {alerts.map(alert => (
              <div key={alert.id} className={alertItemCls(alert.severity)}>
                <div className={`${s.alertIcon} ${alertIconCls(alert.severity)}`}>
                  {alert.severity === "critical" ? <AlertTriangle size={18} /> :
                   alert.severity === "warning"  ? <AlertCircle  size={18} /> :
                                                   <Info         size={18} />}
                </div>
                <div className={s.alertContent}>
                  <div className={alertTitleCls(alert.severity)}>{alert.titleFA}</div>
                  <div className={s.alertMessage}>{alert.messageFA}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION 1: STRATEGY CENTER
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.sec1}</h2>
              <p className={cardStyles.sectionDesc}>{FA.sec1Desc}</p>
            </div>
          </div>

          <div className={s.strategyPanel}>
            {/* ─── Recommendation card ─────────────────────────────── */}
            <div className={`${s.recommendationCard} ${recCardCls(rec.action)}`}>
              <div className={s.recBadgeRow}>
                <span className={`${s.recActionBadge} ${recBadgeCls(rec.action)}`}>
                  {rec.action === "BUY_AUD"  ? <ArrowDownCircle size={13} /> :
                   rec.action === "SELL_AUD" ? <ArrowUpCircle   size={13} /> :
                   rec.action === "HOLD"     ? <Minus            size={13} /> :
                                               <AlertTriangle    size={13} />}
                  &nbsp;{FA[rec.action as keyof typeof FA]}
                </span>
                <span className={`${s.riskBadge} ${riskCls(rec.riskLevel)}`}>
                  {riskFA(rec.riskLevel)}
                </span>
                <span className={`${s.trendBadge} ${trendBadgeCls(trend.healthScoreTrend)}`}>
                  {trendFA(trend.healthScoreTrend)}
                </span>
              </div>

              <div className={s.recTitle}>{rec.titleFA}</div>
              <div className={s.recBody}>{rec.reasoningFA}</div>

              {rec.inactionRiskFA && (
                <div className={s.recBlock}>
                  <div className={s.recBlockLabel}>{FA.inactionLabel}</div>
                  <div className={s.recBlockText}>{rec.inactionRiskFA}</div>
                </div>
              )}
              {rec.suggestedActionFA && (
                <div className={s.recBlock}>
                  <div className={s.recBlockLabel}>{FA.actionLabel}</div>
                  <div className={s.recBlockText}>{rec.suggestedActionFA}</div>
                </div>
              )}

              {rec.drivingMetrics.length > 0 && (
                <div style={{ marginTop: "0.625rem" }}>
                  <div className={s.recBlockLabel} style={{ marginBottom: "0.375rem" }}>
                    {FA.drivingLabel}
                  </div>
                  <div className={s.drivingMetrics}>
                    {rec.drivingMetrics.slice(0, 3).map(m => (
                      <span key={m} className={s.drivingChip}>{m}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className={s.confidenceBar} style={{ marginTop: "0.875rem" }}>
                <div className={s.confidenceTrack}>
                  <div className={s.confidenceFill} style={{ width: pct(rec.confidence) }} />
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", minWidth: "80px", direction: "ltr" }}>
                  {FA.confLabel}: {pct(rec.confidence, 0)}
                </span>
              </div>

              <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-soft, #eaecf0)", direction: "rtl", fontFamily: "var(--font-fa-content, Tahoma, sans-serif)" }}>
                <span style={{ fontSize: "0.675rem", color: "var(--text-dim, #6b7280)" }}>
                  آخرین به‌روزرسانی:{" "}
                  <span dir="ltr" style={{ fontFamily: "var(--font-en-stack, 'Inter', sans-serif)", fontSize: "0.675rem" }}>
                    {new Date().toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
              </div>
            </div>

            {/* ─── Health score card ───────────────────────────────── */}
            <div className={s.healthCard}>
              <div className={s.healthScoreRow}>
                <div className={`${s.healthScoreCircle} ${scoreCircleCls(hs.category)}`}>
                  <span className={`${s.healthScoreNum} ${scoreNumCls(hs.category)}`}>
                    {Math.round(hs.score)}
                  </span>
                  <span className={s.healthScoreLabel}>{FA.healthLabel}</span>
                </div>
                <div className={s.healthScoreInfo}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span className={`${s.healthCategoryBadge} ${catBadgeCls(hs.category)}`}>
                      {catFA(hs.category)}
                    </span>
                    <span className={`${s.trendBadge} ${trendBadgeCls(hs.trend)}`}>
                      {trendFA(hs.trend)}
                    </span>
                  </div>
                  <div className={s.healthExplanation} style={{ marginTop: "0.5rem" }}>
                    {hs.explanationFA}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.625rem", direction: "rtl" }}>
                  {FA.breakdownLabel}
                </div>
                <div className={s.healthBreakdown}>
                  {breakdownItems.map(item => (
                    <div key={item.label} className={s.breakdownRow}>
                      <span className={s.breakdownLabel}>{item.label}</span>
                      <div className={s.breakdownTrack}>
                        <div
                          className={s.breakdownFill}
                          style={{ width: `${item.score}%`, background: scoreBarColor(item.score) }}
                        />
                      </div>
                      <span className={s.breakdownScore} style={{ color: scoreBarColor(item.score) }}>
                        {Math.round(item.score)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Rate Adjustment card (S1-B) ─────────────────────── */}
          <div className={s.rateAdjCard}>
            <div className={s.rateAdjHeader}>
              <ArrowRight size={16} style={{ color: "var(--text-dim)" }} />
              <span className={s.rateAdjTitle}>{FA.rateAdjTitle}</span>
            </div>
            <div className={s.rateAdjGrid}>
              <div className={s.rateAdjItem}>
                <span className={s.rateAdjLabel}>{FA.rateAdjBuyLabel}</span>
                <span className={`${s.rateAdjDelta} ${
                  rateAdj.buyRateDelta > 0 ? s.rateAdjDeltaPos
                  : rateAdj.buyRateDelta < 0 ? s.rateAdjDeltaNeg
                  : s.rateAdjDeltaNeutral
                }`}>
                  {rateAdj.buyRateDelta === 0
                    ? FA.rateAdjNoChange
                    : `${rateAdj.buyRateDelta > 0 ? "+" : ""}${rateAdj.buyRateDelta.toLocaleString()} ${FA.rateAdjToman}`}
                </span>
              </div>
              <div className={s.rateAdjItem}>
                <span className={s.rateAdjLabel}>{FA.rateAdjSellLabel}</span>
                <span className={`${s.rateAdjDelta} ${
                  rateAdj.sellRateDelta > 0 ? s.rateAdjDeltaPos
                  : rateAdj.sellRateDelta < 0 ? s.rateAdjDeltaNeg
                  : s.rateAdjDeltaNeutral
                }`}>
                  {rateAdj.sellRateDelta === 0
                    ? FA.rateAdjNoChange
                    : `${rateAdj.sellRateDelta > 0 ? "+" : ""}${rateAdj.sellRateDelta.toLocaleString()} ${FA.rateAdjToman}`}
                </span>
              </div>
            </div>
            {rateAdj.explanationFA && (
              <div className={s.rateAdjExplanation}>{rateAdj.explanationFA}</div>
            )}
            <div className={s.rateAdjDisclaimer}>{FA.rateAdjDisclaimer}</div>
          </div>

          {/* ─── Forecast card (S1-C) ────────────────────────────────── */}
          <div className={s.forecastCard}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", direction: "rtl", fontFamily: "var(--font-fa-content, Tahoma, sans-serif)" }}>
              <Calendar size={16} style={{ color: "var(--text-dim)" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)" }}>{FA.forecastTitle}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>— {FA.forecastDesc}</span>
            </div>
            {t.forecast.available ? (
              <>
                <div className={s.forecastLabel}>{t.forecast.forecastLabel}</div>
                <div className={s.velocityRow}>
                  <div className={s.velocityItem}>
                    <span className={s.velocityValue}>{fmtAUD(t.forecast.velocity7d)}/day</span>
                    <span className={s.velocityLabel}>{FA.v7Label}</span>
                  </div>
                  <div className={s.velocityItem}>
                    <span className={s.velocityValue}>{fmtAUD(t.forecast.velocity30d)}/day</span>
                    <span className={s.velocityLabel}>{FA.v30Label}</span>
                  </div>
                  <div className={s.velocityItem}>
                    <span className={`${s.velocityValue} ${s.valPositive}`}>{fmtAUD(t.forecast.buyVelocity30d)}/day</span>
                    <span className={s.velocityLabel}>{FA.vBuyLabel}</span>
                  </div>
                  <div className={s.velocityItem}>
                    <span className={`${s.velocityValue} ${t.forecast.netVelocity >= 0 ? s.valPositive : s.valNegative}`}>
                      {t.forecast.netVelocity >= 0 ? "+" : ""}{fmtAUD(t.forecast.netVelocity)}/day
                    </span>
                    <span className={s.velocityLabel}>{FA.vNetLabel}</span>
                  </div>
                  <div className={s.velocityItem}>
                    <span className={`${s.velocityValue} ${
                      t.coverageDays !== null && t.coverageDays < t.settings.inventory_coverage_target_days ? s.valNegative : s.valPositive
                    }`}>{fmtDays(t.coverageDays)}</span>
                    <span className={s.velocityLabel}>{FA.covLabel}</span>
                  </div>
                  {t.forecast.depletionDate && (
                    <div className={s.velocityItem}>
                      <span className={`${s.velocityValue} ${s.valNegative}`}>{t.forecast.depletionDate}</span>
                      <span className={s.velocityLabel}>{FA.depletionLabel}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={s.forecastUnavailable}>{FA.forecastNA}</div>
            )}
          </div>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 2: MARKET & INVENTORY
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.sec2}</h2>
              <p className={cardStyles.sectionDesc}>{FA.sec2Desc}</p>
            </div>
          </div>

          {/* ── Inventory hero card: current + target + gap ─────────── */}
          {(() => {
            const invColor = t.audInventory < 0 ? s.valNegative
              : t.audInventory < t.settings.min_aud_inventory ? s.valNegative
              : t.audInventory > t.settings.max_aud_inventory ? s.valAmber
              : s.valPositive;
            const gapColor = t.inventoryGap >= 0 ? s.valPositive : s.valNegative;
            return (
              <div className={s.inventoryHeroCard} style={{
                borderColor: t.audInventory < t.settings.min_aud_inventory
                  ? "rgba(239,68,68,0.35)"
                  : t.audInventory > t.settings.max_aud_inventory
                    ? "rgba(217,119,6,0.35)"
                    : "rgba(5,150,105,0.3)",
              }}>
                <div className={s.inventoryHeroMain}>
                  <div className={`${cardStyles.statIconCompact} ${t.audInventory < t.settings.min_aud_inventory ? cardStyles.statIconDanger : cardStyles.statIconSuccess}`} style={{ flexShrink: 0 }}>
                    <DollarSign size={22} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className={`${s.inventoryHeroValue} ${invColor}`} dir="ltr">
                        {fmtAUD(t.audInventory)}
                      </span>
                      <span className={`${s.trendBadge} ${trendBadgeCls(trend.inventoryTrend)}`}>
                        {trendFA(trend.inventoryTrend)}
                      </span>
                    </div>
                    <div className={s.inventoryHeroLabel}>{FA.audInventory}</div>
                  </div>
                </div>
                <div className={s.inventoryHeroRow}>
                  <div className={s.inventoryHeroItem}>
                    <span className={s.inventoryHeroItemLabel}>{FA.invTarget}</span>
                    <span className={`${s.inventoryHeroItemValue} ${s.valNeutral}`} dir="ltr">
                      {fmtAUD(t.targetInventory)}
                    </span>
                  </div>
                  <div className={s.inventoryHeroItem}>
                    <span className={s.inventoryHeroItemLabel}>{FA.invGap}</span>
                    <span className={`${s.inventoryHeroItemValue} ${gapColor}`} dir="ltr">
                      {t.inventoryGap >= 0 ? "+" : ""}{fmtAUD(t.inventoryGap)}
                    </span>
                  </div>
                  <div className={s.inventoryHeroItem}>
                    <span className={s.inventoryHeroItemLabel}>{FA.invRatio}</span>
                    <span className={`${s.inventoryHeroItemValue} ${t.inventoryRatio < 0.5 ? s.valAmber : s.valNeutral}`} dir="ltr">
                      {pct(t.inventoryRatio)}
                    </span>
                  </div>
                  <div className={s.inventoryHeroItem}>
                    <span className={s.inventoryHeroItemLabel}>{FA.coverageDays}</span>
                    <span className={`${s.inventoryHeroItemValue} ${
                      t.coverageDays !== null && t.coverageDays < t.settings.inventory_coverage_target_days
                        ? s.valNegative : s.valNeutral
                    }`} dir="ltr">
                      {fmtDays(t.coverageDays)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Supplementary stat cards row ────────────────────────── */}
          <div className={cardStyles.statsGrid} style={{ marginTop: "0.875rem" }}>
            {/* Current Rate */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconAccent}`}>
                <Activity size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valAccent}`}>{fmtRate(t.currentBuyRate)}</span>
                <span className={cardStyles.statLabel}>{FA.currentRate}</span>
                <span className={s.tooltipHint}>{FA.hintCurrentRate}</span>
              </div>
            </div>

            {/* WAC */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconInfo}`}>
                <Scale size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${t.wac > 0 && t.currentBuyRate > t.wac ? s.valPositive : s.valNeutral}`}>
                  {t.wac > 0 ? fmtRate(t.wac) : FA.na}
                </span>
                <span className={cardStyles.statLabel}>{FA.wac}</span>
                {t.wac > 0 && t.currentBuyRate > 0 && (
                  <span className={s.tooltipHint}>{FA.hintWacProfit} {fmtRate(t.currentBuyRate - t.wac)}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Expandable inventory detail ──────────────────────────── */}
          <details className={s.detailsBlock}>
            <summary className={s.detailsSummary}>{FA.invDetailTitle}</summary>
            <div className={s.detailsContent}>
              <div className={s.detailsGrid}>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.invCostVal}</span>
                  <span className={`${s.detailCardValue} ${s.valNeutral}`}>{fmtIRT(t.inventoryCostValueIRT)}</span>
                  <span className={s.detailCardHint}>{fmtAUD(t.audInventory)} × WAC ({fmtRate(t.wac)})</span>
                </div>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.invMarketVal}</span>
                  <span className={`${s.detailCardValue} ${s.valNeutral}`}>{fmtIRT(t.inventoryMarketValueIRT)}</span>
                  <span className={s.detailCardHint}>{fmtAUD(t.audInventory)} × {fmtRate(t.currentBuyRate)}</span>
                </div>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.invValDiff}</span>
                  <span className={`${s.detailCardValue} ${t.inventoryMarketValueIRT - t.inventoryCostValueIRT >= 0 ? s.valPositive : s.valNegative}`}>
                    {t.inventoryMarketValueIRT - t.inventoryCostValueIRT >= 0 ? "+" : ""}
                    {fmtIRT(t.inventoryMarketValueIRT - t.inventoryCostValueIRT)}
                  </span>
                  <span className={s.detailCardHint}>{FA.hintValDiff}</span>
                </div>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.invGapPct}</span>
                  <span className={`${s.detailCardValue} ${t.inventoryGapPercent >= 0 ? s.valPositive : s.valNegative}`}>
                    {t.inventoryGapPercent >= 0 ? "+" : ""}{t.inventoryGapPercent.toFixed(1)}%
                  </span>
                  <span className={s.detailCardHint}>{FA.hintRelToTarget}</span>
                </div>
              </div>
            </div>
          </details>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 3: LIQUIDITY & ACCOUNTS
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.sec3}</h2>
              <p className={cardStyles.sectionDesc}>{FA.sec3Desc}</p>
            </div>
          </div>

          <AccountBalanceForm
            initialKadoos={settings.kadoos_balance_irt}
            initialPezhman={settings.pezhman_balance_irt}
          />

          {/* ── Total Iran Liquidity — priority hero ─────────────────── */}
          <div className={`${s.liquidityHeroCard} ${t.liquidityRatio < 1 ? s.liquidityHeroCritical : s.liquidityHeroOk}`}>
            <div className={s.liquidityHeroLeft}>
              <div className={t.liquidityRatio < 1 ? cardStyles.statIconDanger : cardStyles.statIconSuccess} style={{ padding: "0.5rem", borderRadius: "50%", background: t.liquidityRatio < 1 ? "rgba(239,68,68,0.1)" : "rgba(5,150,105,0.1)", display: "flex", flexShrink: 0 }}>
                <Coins size={22} color={t.liquidityRatio < 1 ? "#ef4444" : "#059669"} />
              </div>
              <div className={s.liquidityHeroInfo}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className={`${s.liquidityHeroValue} ${t.liquidityRatio < 1 ? s.valNegative : s.valPositive}`} dir="ltr">
                    {fmtIRT(t.totalIranLiquidityIRT)}
                  </span>
                  <span className={`${s.trendBadge} ${trendBadgeCls(trend.liquidityTrend)}`}>
                    {trendFA(trend.liquidityTrend)}
                  </span>
                </div>
                <div className={s.liquidityHeroTitle}>{FA.totalLiquidity}</div>
                <span className={s.tooltipHint}>{FA.hintMinLiq} {fmtIRT(t.settings.min_irt_liquidity)}</span>
              </div>
            </div>
            <div className={s.liquidityHeroRight}>
              <div className={s.liquidityHeroSubItem}>
                <span className={s.liquidityHeroSubLabel}>{FA.kadoosBalance}</span>
                <span className={`${s.liquidityHeroSubValue} ${s.valNeutral}`} dir="ltr">{fmtIRT(t.kadoosBalanceIRT)}</span>
              </div>
              <div className={s.liquidityHeroSubItem}>
                <span className={s.liquidityHeroSubLabel}>{FA.pezhmanBalance}</span>
                <span className={`${s.liquidityHeroSubValue} ${s.valNeutral}`} dir="ltr">{fmtIRT(t.pezhmanBalanceIRT)}</span>
              </div>
            </div>
          </div>

          {/* ── Stat cards row ───────────────────────────────────────── */}
          <div className={cardStyles.statsGrid}>
            {/* Net Business Value */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${a.netBusinessValueIRT >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
                <ShieldCheck size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.netBusinessValueIRT >= 0 ? s.valPositive : s.valNegative}`}>
                  {fmtIRT(a.netBusinessValueIRT)}
                </span>
                <span className={cardStyles.statLabel}>{FA.netBV}</span>
              </div>
            </div>

            {/* Cash Runway (liquid) */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${
                t.liquidRunwayMonths === null ? cardStyles.statIconInfo
                : t.liquidRunwayMonths < t.settings.cash_runway_target_months ? cardStyles.statIconWarning
                : cardStyles.statIconSuccess
              }`}>
                <Calendar size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${
                  t.liquidRunwayMonths === null ? s.valNeutral
                  : t.liquidRunwayMonths < t.settings.cash_runway_target_months ? s.valAmber
                  : s.valPositive
                }`}>
                  {fmtMonths(t.liquidRunwayMonths)}
                </span>
                <span className={cardStyles.statLabel}>{FA.cashRunwayLiquid}</span>
                <span className={s.tooltipHint}>{FA.hintTarget} {t.settings.cash_runway_target_months} {FA.monthsUnit}</span>
              </div>
            </div>
          </div>

          {/* ── Expandable Runway detail ─────────────────────────────── */}
          <details className={s.detailsBlock}>
            <summary className={s.detailsSummary}>{FA.runwayDetailTitle}</summary>
            <div className={s.detailsContent}>
              <div className={s.detailsGrid}>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.cashRunwayLiquid}</span>
                  <span className={`${s.detailCardValue} ${
                    t.liquidRunwayMonths !== null && t.liquidRunwayMonths < t.settings.cash_runway_target_months ? s.valAmber : s.valNeutral
                  }`}>{fmtMonths(t.liquidRunwayMonths)}</span>
                  <span className={s.detailCardHint}>{FA.hintLiquidOnly}</span>
                </div>
                <div className={s.detailCard}>
                  <span className={s.detailCardLabel}>{FA.cashRunwayTotal}</span>
                  <span className={`${s.detailCardValue} ${s.valPositive}`}>{fmtMonths(t.totalRunwayMonths)}</span>
                  <span className={s.detailCardHint}>{FA.hintCashPlusInv}</span>
                </div>
              </div>
            </div>
          </details>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 4: EXPOSURE
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.secExposure}</h2>
              <p className={cardStyles.sectionDesc}>{FA.secExposureDesc}</p>
            </div>
          </div>

          <div className={cardStyles.statsGrid}>
            {/* Market Basis Exposure — primary */}
            <div className={`${cardStyles.statCardCompact} ${exposureCardCls(t.exposureMarketBasis, t.settings.target_exposure_ratio, t.settings.max_aud_exposure)}`}>
              <div className={`${cardStyles.statIconCompact} ${
                t.exposureMarketBasis > t.settings.max_aud_exposure ? cardStyles.statIconDanger
                : t.exposureMarketBasis > t.settings.max_aud_exposure * 0.85 ? cardStyles.statIconWarning
                : cardStyles.statIconSuccess
              }`}>
                <Percent size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <span className={`${cardStyles.statValue} ${
                    t.exposureMarketBasis > t.settings.max_aud_exposure ? s.valNegative
                    : t.exposureMarketBasis > t.settings.max_aud_exposure * 0.85 ? s.valAmber
                    : s.valPositive
                  }`}>{pct(t.exposureMarketBasis)}</span>
                  <span className={`${s.trendBadge} ${trendBadgeCls(trend.exposureTrend)}`}>
                    {trendFA(trend.exposureTrend)}
                  </span>
                </div>
                <span className={cardStyles.statLabel}>{FA.exposureMarket}</span>
                <span className={s.tooltipHint}>{FA.hintTarget} {pct(t.settings.target_exposure_ratio)} | {FA.hintMax} {pct(t.settings.max_aud_exposure)}</span>
              </div>
            </div>

            {/* Cost Basis Exposure */}
            <div className={`${cardStyles.statCardCompact} ${exposureCardCls(t.exposureCostBasis, t.settings.target_exposure_ratio, t.settings.max_aud_exposure)}`}>
              <div className={`${cardStyles.statIconCompact} ${
                t.exposureCostBasis > t.settings.max_aud_exposure ? cardStyles.statIconDanger
                : cardStyles.statIconInfo
              }`}>
                <Scale size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${
                  t.exposureCostBasis > t.settings.max_aud_exposure ? s.valNegative
                  : t.exposureCostBasis > t.settings.max_aud_exposure * 0.85 ? s.valAmber
                  : s.valNeutral
                }`}>{pct(t.exposureCostBasis)}</span>
                <span className={cardStyles.statLabel}>{FA.exposureCost}</span>
                <span className={s.tooltipHint}>{FA.hintExposureCost}</span>
              </div>
            </div>

            {/* Target Exposure (reference) */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconAccent}`}>
                <Activity size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valAccent}`}>{pct(t.settings.target_exposure_ratio)}</span>
                <span className={cardStyles.statLabel}>{FA.exposureTarget}</span>
                <span className={s.tooltipHint}>{FA.hintExpTarget}</span>
              </div>
            </div>

            {/* Max Exposure (reference) */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconWarning}`}>
                <AlertCircle size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valAmber}`}>{pct(t.settings.max_aud_exposure)}</span>
                <span className={cardStyles.statLabel}>{FA.exposureMax}</span>
                <span className={s.tooltipHint}>{FA.hintExpMax}</span>
              </div>
            </div>
          </div>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 5: PROFITABILITY
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.sec4}</h2>
              <p className={cardStyles.sectionDesc}>{FA.sec4Desc}</p>
            </div>
          </div>

          <div className={cardStyles.statsGrid} style={{ marginBottom: "1.25rem" }}>
            {/* Realized Trading Profit */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${a.realizedTradingProfit >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
                <TrendingUp size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.realizedTradingProfit >= 0 ? s.valPositive : s.valNegative}`}>
                  {fmtIRT(a.realizedTradingProfit)}
                </span>
                <span className={cardStyles.statLabel}>{FA.realizedProfit}</span>
                <span className={s.tooltipHint}>{FA.hintRealizedProfit}</span>
              </div>
            </div>

            {/* Fee Income */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconSuccess}`}>
                <CreditCard size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valPositive}`}>{fmtIRT(a.feeIncomeIRT)}</span>
                <span className={cardStyles.statLabel}>{FA.feeIncome}</span>
                <span className={s.tooltipHint}>{FA.hintFeeIncome}</span>
              </div>
            </div>

            {/* Paid Expenses */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconDanger}`}>
                <TrendingDown size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valNegative}`}>{fmtIRT(a.paidExpensesIRT)}</span>
                <span className={cardStyles.statLabel}>{FA.paidExpenses}</span>
                {a.pendingExpensesIRT > 0 && (
                  <span className={s.tooltipHint}>{FA.pending}: {fmtIRT(a.pendingExpensesIRT)}</span>
                )}
              </div>
            </div>

            {/* Operating Profit */}
            <div className={cardStyles.statCardCompact} style={{ border: "2px solid var(--border-soft)" }}>
              <div className={`${cardStyles.statIconCompact} ${a.operatingProfit >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
                <BarChart2 size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <span className={`${cardStyles.statValue} ${a.operatingProfit >= 0 ? s.valPositive : s.valNegative}`}>
                    {fmtIRT(a.operatingProfit)}
                  </span>
                  <span className={`${s.trendBadge} ${trendBadgeCls(trend.profitabilityTrend)}`}>
                    {trendFA(trend.profitabilityTrend)}
                  </span>
                </div>
                <span className={cardStyles.statLabel}>{FA.operatingProfit}</span>
                <span className={s.tooltipHint}>{FA.hintOperatingProfit}</span>
              </div>
            </div>

            {/* Unrealized P/L */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${a.unrealizedPL >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconWarning}`}>
                <Percent size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.unrealizedPL >= 0 ? s.valPositive : s.valAmber}`}>
                  {fmtIRT(a.unrealizedPL)}
                </span>
                <span className={cardStyles.statLabel}>{FA.unrealizedPL}</span>
                <span className={s.tooltipHint}>{FA.hintUnrealizedPL}</span>
              </div>
            </div>

            {/* Total Profit */}
            <div className={cardStyles.statCardCompact} style={{ border: "2px solid var(--border-soft)" }}>
              <div className={`${cardStyles.statIconCompact} ${a.totalProfit >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
                <Coins size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.totalProfit >= 0 ? s.valPositive : s.valNegative}`}>
                  {fmtIRT(a.totalProfit)}
                </span>
                <span className={cardStyles.statLabel}>{FA.totalProfit}</span>
                <span className={s.tooltipHint}>{FA.hintTotalProfit}</span>
              </div>
            </div>
          </div>

          {/* Expenses panel */}
          <div className={cardStyles.panel}>
            <div className={cardStyles.panelHeader}>
              <div>
                <h3 className={cardStyles.panelTitle}>{FA.expensesPanel}</h3>
              </div>
            </div>
            <div className={cardStyles.panelBody}>
              <ExpenseForm expenses={expenses} />
            </div>
          </div>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 5: OWNER CAPITAL
            ══════════════════════════════════════════════════════════ */}
        <section>
          <div className={`${cardStyles.sectionHeader} ${cardStyles.sectionHeaderMd}`}>
            <div>
              <h2 className={cardStyles.sectionTitle}>{FA.sec5}</h2>
              <p className={cardStyles.sectionDesc}>{FA.sec5Desc}</p>
            </div>
          </div>

          <div className={cardStyles.statsGrid} style={{ marginBottom: "1.25rem" }}>
            {/* Owner Loan Balance */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconWarning}`}>
                <CreditCard size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.ownerLoanBalanceIRT > 0 ? s.valAmber : s.valNeutral}`}>
                  {fmtIRT(a.ownerLoanBalanceIRT)}
                </span>
                <span className={cardStyles.statLabel}>{FA.loanBalance}</span>
                <span className={s.tooltipHint}>{FA.hintOwnerLoan}</span>
              </div>
            </div>

            {/* Total Assets */}
            <div className={cardStyles.statCardCompact}>
              <div className={`${cardStyles.statIconCompact} ${cardStyles.statIconAccent}`}>
                <ShieldCheck size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${s.valAccent}`}>{fmtIRT(a.totalAssetValueIRT)}</span>
                <span className={cardStyles.statLabel}>{FA.totalAssets}</span>
                <span className={s.tooltipHint}>{FA.hintTotalAssets}</span>
              </div>
            </div>

            {/* Net Business Value */}
            <div className={cardStyles.statCardCompact} style={{ border: "2px solid var(--border-soft)" }}>
              <div className={`${cardStyles.statIconCompact} ${a.netBusinessValueIRT >= 0 ? cardStyles.statIconSuccess : cardStyles.statIconDanger}`}>
                <Scale size={20} />
              </div>
              <div className={cardStyles.statInfo}>
                <span className={`${cardStyles.statValue} ${a.netBusinessValueIRT >= 0 ? s.valPositive : s.valNegative}`}>
                  {fmtIRT(a.netBusinessValueIRT)}
                </span>
                <span className={cardStyles.statLabel}>{FA.netBV}</span>
                <span className={s.tooltipHint}>{FA.hintNetBV}</span>
              </div>
            </div>
          </div>

          {/* Owner loans panel */}
          <div className={cardStyles.panel}>
            <div className={cardStyles.panelHeader}>
              <div>
                <h3 className={cardStyles.panelTitle}>{FA.loansPanel}</h3>
              </div>
            </div>
            <div className={cardStyles.panelBody}>
              <OwnerLoanForm loans={ownerLoans} />
            </div>
          </div>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 7: TREASURY SETTINGS (collapsible)
            ══════════════════════════════════════════════════════════ */}
        <section>
          <details className={s.settingsDetails}>
            <summary className={s.settingsSummary}>
              <Settings size={16} color="var(--text-soft)" />
              <span className={s.settingsSummaryTitle}>{FA.secSettings}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{FA.secSettingsDesc}</span>
            </summary>
            <div className={s.settingsBody}>
              <p style={{ fontSize: "0.8125rem", color: "var(--text-dim)", direction: "rtl", fontFamily: "var(--font-fa-content, Tahoma, sans-serif)", marginBottom: "1rem" }}>
                {FA.settingsBody1}
              </p>
              {/* TreasurySettingsForm will be added here when SystemSettingsForm is extended */}
              <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", direction: "rtl", fontFamily: "var(--font-fa-content, Tahoma, sans-serif)", fontStyle: "italic" }}>
                {FA.settingsBody2}
              </p>
            </div>
          </details>
        </section>

        <hr className={s.sectionDivider} />

        {/* ══════════════════════════════════════════════════════════
            SECTION 8: RECONCILIATION — PLACEHOLDER (future)
            ══════════════════════════════════════════════════════════ */}
        <section>
          <details className={s.reconDetails}>
            <summary className={s.reconSummary}>
              <RefreshCw size={15} color="var(--text-dim)" />
              <span className={s.reconSummaryTitle}>{FA.secRecon} 🔄</span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-dim)" }}>{FA.secReconDesc}</span>
            </summary>
            <div className={s.reconBody}>
              {(["kadoos", "pezhman", "zarman"] as const).map(acc => (
                <div key={acc} className={s.reconAccount}>
                  <div className={s.reconAccountTitle}>
                    {acc === "kadoos"  ? "\u06a9\u0627\u062f\u0648\u0633 (IRT)" :
                     acc === "pezhman" ? "\u067e\u0698\u0645\u0627\u0646 (IRT)" :
                                        "\u0632\u0627\u0631\u0645\u0646 (AUD)"}
                  </div>
                  <div className={s.reconAccountBody}>
                    {acc === "kadoos"  ? `\u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647: ${fmtIRT(t.kadoosBalanceIRT)}` :
                     acc === "pezhman" ? `\u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647: ${fmtIRT(t.pezhmanBalanceIRT)}` :
                                        `\u0645\u0648\u062c\u0648\u062f\u06cc \u0645\u062d\u0627\u0633\u0628\u0647\u200c\u0634\u062f\u0647: ${fmtAUD(a.audInventory)}`}
                  </div>
                  <span className={s.reconComingSoon}>{FA.reconComingSoon}</span>
                </div>
              ))}
            </div>
          </details>
        </section>

      </div>
    </>
  );
}
