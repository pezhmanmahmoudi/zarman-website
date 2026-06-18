# Treasury Dashboard — UI Specification v1
**Status:** AWAITING APPROVAL  
**Page route:** `/admin/treasury`  
**Server Component:** `app/(panel)/admin/(protected)/treasury/page.tsx`  
**Data source:** `getTreasuryFullData()` → `{ accounting, treasury, strategy, ownerLoans, expenses, settings }`

---

## 0. Layout Principles

### Responsive Breakpoints
| Breakpoint | Name | Behaviour |
|---|---|---|
| `< 640px` | mobile | Single column, full-width stacked |
| `640px – 1024px` | tablet | 2-column grid for stat cards |
| `> 1024px` | desktop | Mixed: 2-col strategy panel + 3–4-col stat grids |

### Direction
- All Persian text: `direction: rtl`  
- All numbers and currency values: `direction: ltr` inside an `rtl` container (use `<bdi>` or `dir="ltr"` spans where needed)

### Scrolling
- Page scrolls vertically. No horizontal scroll.  
- The top bar is sticky on desktop (already implemented in `AdminShell.module.css`).

---

## 1. Top Bar

**Already implemented.** No changes required.

| Element | Content | Condition |
|---|---|---|
| Page title (h1) | "خزانه‌داری و استراتژی" | Always |
| Critical alert badge | Red pill: `<n> بحرانی` | `criticalAlertCount > 0` |
| Accounting warning badge | Amber pill: `<n> هشدار داده` | `accountingWarnings.length > 0` ← **NEW** |

---

## 2. Page Sections (in vertical order)

```
┌─────────────────────────────────────────────────────┐
│  ZONE A: Accounting Warnings Banner                  │  conditional — amber
├─────────────────────────────────────────────────────┤
│  ZONE B: Active Alerts Banner                        │  conditional — red/amber/blue
├─────────────────────────────────────────────────────┤
│  SECTION 1: Strategy Center                          │  always visible
│    ├── S1-A: Recommendation Card + Health Card       │  side-by-side desktop / stacked mobile
│    ├── S1-B: Rate Adjustment Card                    │  NEW — full width
│    └── S1-C: Forecast Card                          │  full width
├─────────────────────────────────────────────────────┤
│  SECTION 2: Inventory & Market                       │  always visible
│    └── Stat cards row + Inventory Detail Expander    │
├─────────────────────────────────────────────────────┤
│  SECTION 3: Liquidity & Accounts                     │  always visible
│    ├── Account Balance Form                          │
│    └── Stat cards row + Runway Detail Expander       │  runway EXPANDED to dual metric
├─────────────────────────────────────────────────────┤
│  SECTION 4: Exposure                                 │  NEW dedicated section
│    └── Dual exposure stat cards + Exposure Detail    │
├─────────────────────────────────────────────────────┤
│  SECTION 5: Profitability                            │  (was Section 4)
│    ├── Stat cards row                                │
│    └── Expenses Panel + Form                         │
├─────────────────────────────────────────────────────┤
│  SECTION 6: Owner Capital                            │  (was Section 5)
│    ├── Stat cards row                                │
│    └── Owner Loans Panel + Form                      │
├─────────────────────────────────────────────────────┤
│  SECTION 7: Settings                                 │  NEW — collapsible
│    └── Treasury Settings Form                        │
├─────────────────────────────────────────────────────┤
│  SECTION 8: Reconciliation [FUTURE — PLACEHOLDER]   │  Collapsed stub only
│    ├── Kadoos Reconciliation                         │
│    ├── Pezhman Reconciliation                        │
│    └── Zarman Reconciliation                         │
└─────────────────────────────────────────────────────┘
```

---

## 3. Zone A — Accounting Warnings Banner

**Condition:** renders only when `strategy.accountingWarnings.length > 0`  
**Position:** Above all other content, below the top bar.  
**Style:** Amber background panel, collapsible after first view.

### Layout
```
┌─────────────────────────────────────────────────────┐
│ ⚠  هشدارهای داده‌ای حسابداری  (n هشدار)  [▾ نمایش]  │  header row — always visible
│─────────────────────────────────────────────────────│
│ • <warning text 1>                                   │  collapsed by default
│ • <warning text 2>                                   │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

### Data source
`strategy.accountingWarnings: string[]`

### Warning types rendered
| Warning message pattern | User-facing severity |
|---|---|
| `"موجودی دلار بعد از ردیف ... منفی شد"` | 🔴 Critical — render in red inside amber panel |
| `"... فاقد نرخ تاریخی است"` (expense/loan) | 🟡 Warning — standard amber |
| Any other warning string | 🟡 Warning |

### Behaviour
- Collapsed by default (`<details>` element or client toggle)
- On expand: shows full list of warning strings, one per line with `•` bullet
- The header count badge `(n هشدار)` always stays visible even when collapsed

---

## 4. Zone B — Active Alerts Banner

**Condition:** renders only when `strategy.alerts.length > 0`  
**Style:** Already implemented. No structural changes.

### Alert severity styling
| Severity | Background | Icon | Border |
|---|---|---|---|
| `critical` | `rgba(239,68,68,0.08)` | `<AlertTriangle>` red | `1px solid rgba(239,68,68,0.3)` |
| `warning` | `rgba(245,158,11,0.08)` | `<AlertCircle>` amber | `1px solid rgba(245,158,11,0.3)` |
| `info` | `rgba(99,102,241,0.08)` | `<Info>` indigo | `1px solid rgba(99,102,241,0.2)` |

### Alert content per item
| Field | Display |
|---|---|
| `alert.titleFA` | Bold headline |
| `alert.messageFA` | Body text |
| `alert.severity` | Determines icon + colour class |

### Alert ordering
Sorted by engine: `critical` → `warning` → `info`. No re-sorting needed in UI.

### Alert categories that can appear
| Category | When triggered |
|---|---|
| `inventory` | `audInventory < min_aud_inventory` OR `> max_aud_inventory` |
| `liquidity` | `liquidityRatio < 1` |
| `exposure` | `exposureMarketBasis > max_aud_exposure` |
| `forecast` | `coverageDays < inventory_coverage_target_days` |
| `cash_runway` | `liquidRunwayMonths < cash_runway_target_months` |

---

## 5. Section 1 — Strategy Center

### S1-A: Recommendation + Health Score (side-by-side on desktop)

#### Desktop (≥ 1024px)
```
┌────────────────────────────────┬───────────────────────┐
│   RECOMMENDATION CARD (60%)    │  HEALTH SCORE (40%)   │
└────────────────────────────────┴───────────────────────┘
```

#### Mobile (< 640px)
```
┌──────────────────────────────────┐
│       RECOMMENDATION CARD        │
├──────────────────────────────────┤
│        HEALTH SCORE CARD         │
└──────────────────────────────────┘
```

---

#### Recommendation Card — Full Spec

**Background tint:** changes per action:
| Action | Background class | Accent colour |
|---|---|---|
| `BUY_AUD` | `recBuyAUD` | Emerald green |
| `SELL_AUD` | `recSellAUD` | Indigo/purple |
| `HOLD` | `recHold` | Slate/neutral |
| `CAUTION` | `recCaution` | Amber |

**Content blocks (top to bottom):**

1. **Badge row**
   - Action badge (icon + Persian label): `BUY_AUD` / `SELL_AUD` / `HOLD` / `CAUTION`
   - Risk level badge: `پایین` / `متوسط` / `بالا` / `زیاد` / `بحرانی`
   - Trend badge ← **NEW**: `↗ در حال بهبود` / `→ پایدار` / `↘ در حال کاهش` derived from `strategy.trendAnalysis.healthScoreTrend`

2. **Title**: `rec.titleFA` — bold, 1.1rem+

3. **Reasoning block**: `rec.reasoningFA` — body text

4. **Inaction risk block** (if non-empty)
   - Label: "ریسک عدم اقدام"
   - Text: `rec.inactionRiskFA`

5. **Suggested action block** (if non-empty)
   - Label: "اقدام پیشنهادی"
   - Text: `rec.suggestedActionFA`

6. **Driving metrics** ← **NEW**
   - Label: "شاخص‌های محرک"
   - Rendered as small pill badges: `rec.drivingMetrics[]`

7. **Confidence bar** (already implemented)
   - Track + fill, label: `اطمینان: {pct(rec.confidence, 0)}`

**Tooltip:** On hover of the action badge → "این توصیه فقط بر اساس وضعیت داخلی خزانه محاسبه می‌شود و پیش‌بینی نرخ ارز نیست."

---

#### Health Score Card — Full Spec

**Content blocks (top to bottom):**

1. **Score circle**: large circle with number `Math.round(hs.score)` and label "امتیاز سلامت"
   - Colour: green ≥ 80, amber ≥ 60, orange ≥ 40, red < 40

2. **Category badge**: `ممتاز` / `خوب` / `احتیاط` / `بحرانی`

3. **Trend indicator** ← **NEW inline with category**
   - `↗ در حال بهبود` / `→ پایدار` / `↘ در حال کاهش`
   - Source: `hs.trend`
   - Tooltip: "روند مقایسه با آخرین تصویر ذخیره‌شده"

4. **Explanation**: `hs.explanationFA`

5. **Breakdown bars** (already implemented, no change)
   | Component | Weight | Source |
   |---|---|---|
   | موجودی | 30% | `hs.breakdown.inventory` |
   | نقدینگی | 25% | `hs.breakdown.liquidity` |
   | مواجهه | 20% | `hs.breakdown.exposure` |
   | سودآوری | 15% | `hs.breakdown.profitability` |
   | پیش‌بینی | 10% | `hs.breakdown.forecast` |

**Tooltip on score circle:** "امتیاز ۰–۱۰۰ ترکیبی از ۵ شاخص با وزن‌های مشخص است."

---

### S1-B: Rate Adjustment Card ← **NEW — Full Width**

**Condition:** Always renders. When `buyRateDelta === 0 && sellRateDelta === 0`, renders "neutral" state.

**Source:** `strategy.rateAdjustmentSuggestion`

```
┌─────────────────────────────────────────────────────────┐
│  💱  پیشنهاد تنظیم نرخ                                  │  section label
│─────────────────────────────────────────────────────────│
│  ┌───────────────────┐  ┌───────────────────┐           │
│  │ نرخ خرید          │  │ نرخ فروش          │           │
│  │  +300 تومان       │  │  +100 تومان       │           │
│  └───────────────────┘  └───────────────────┘           │
│  توضیح: <explanationFA>                                  │
└─────────────────────────────────────────────────────────┘
```

**Delta display rules:**
| Delta value | Display | Colour |
|---|---|---|
| `> 0` | `+{delta} تومان` | Green |
| `< 0` | `{delta} تومان` | Red |
| `= 0` | `بدون تغییر` | Neutral/dim |

**Tooltip on buy delta:** "افزایش نرخ خرید برای جذب فرستندگان دلار توصیه می‌شود."  
**Tooltip on sell delta:** "افزایش نرخ فروش برای کسب سود بیشتر در خروجی‌ها توصیه می‌شود."

**Disclaimer (small text below):** "این پیشنهاد صرفاً بر اساس موجودی و نقدینگی است. هیچ پیش‌بینی نرخ ارز در آن وجود ندارد."

---

### S1-C: Forecast Card — Updated Spec

**Source:** `treasury.forecast`

**Layout (desktop, 4 columns when available):**
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ سرعت ۷ روزه │ سرعت ۳۰ روزه │ سرعت خرید   │  سرعت خالص  │  ← NEW: buy + net velocity
├──────────────┼──────────────┼──────────────┼──────────────┤
│ پوشش روزانه │ تاریخ تخمین  │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Layout (mobile, 2 columns):**
```
┌──────────────┬──────────────┐
│ سرعت ۷ روزه │ سرعت ۳۰ روزه │
├──────────────┼──────────────┤
│ سرعت خرید   │ سرعت خالص    │
├──────────────┼──────────────┤
│ پوشش روزانه │ تاریخ تخمین  │
└──────────────┴──────────────┘
```

**Metric definitions:**
| Label | Source | Unit | Colour logic |
|---|---|---|---|
| سرعت ۷ روزه | `forecast.velocity7d` | AUD/day | Neutral |
| سرعت ۳۰ روزه | `forecast.velocity30d` | AUD/day | Neutral |
| سرعت خرید ۳۰ روزه ← **NEW** | `forecast.buyVelocity30d` | AUD/day | Green |
| سرعت خالص ← **NEW** | `forecast.netVelocity` | AUD/day | Green if > 0, Red if < 0 |
| پوشش روزانه | `t.coverageDays` | days | Red < target, Green ≥ target |
| تاریخ تخمین | `forecast.depletionDate` | date string | Red (urgent) |

**Net velocity tooltip:** "سرعت خالص = میانگین خرید ۳۰ روزه − سرعت فروش. مثبت یعنی ذخیره در حال افزایش است."

**Label of forecast card:** `forecast.forecastLabel`

**Unavailable state:** single line `"داده کافی برای پیش‌بینی وجود ندارد."`

---

## 6. Section 2 — Inventory & Market

### Stat Cards (primary row)

| # | Metric | Source | Unit | Colour logic |
|---|---|---|---|---|
| 1 | نرخ خرید فعلی | `t.currentBuyRate` | IRT/AUD | Accent (always) |
| 2 | موجودی دلار | `t.audInventory` | AUD | Red if < min, Amber if > max, Green otherwise |
| 3 | میانگین وزنی (WAC) | `t.wac` | IRT/AUD | Green if WAC < currentRate (profitable), Neutral otherwise |
| 4 | نسبت موجودی | `t.inventoryRatio` | % | Red < 50%, Amber 50–80% or > 150%, Green 80–150% |
| 5 | پوشش روزانه | `t.coverageDays` | days | Red < target, Green ≥ target |

### Tooltips on stat cards
| Card | Tooltip content |
|---|---|
| موجودی دلار | هدف: {target_aud_inventory} \| حداقل: {min_aud_inventory} \| حداکثر: {max_aud_inventory} |
| WAC | سود هر دلار: {currentRate − WAC} تومان |
| نسبت موجودی | {inventoryGap > 0 ? "+" : ""}{fmtAUD(inventoryGap)} نسبت به هدف ({inventoryGapPercent}%) |
| پوشش روزانه | هدف: {inventory_coverage_target_days} روز |

### Expandable Detail Panel — Inventory ← **NEW**

Triggered by a "جزئیات بیشتر ▾" link below the stat card row.

**Collapsed:** single row of cards (already shown above)  
**Expanded:** adds a second row of detail cards:

| # | Metric | Source | Unit | Notes |
|---|---|---|---|---|
| A | ارزش موجودی (بهای تمام‌شده) | `t.inventoryCostValueIRT` | IRT | `audInventory × WAC` |
| B | ارزش موجودی (بازار) | `t.inventoryMarketValueIRT` | IRT | `audInventory × currentRate` |
| C | اختلاف ارزش‌گذاری | `inventoryMarketValueIRT − inventoryCostValueIRT` | IRT | Green if positive (market > cost) |
| D | موجودی هدف | `t.targetInventory` | AUD | = `settings.target_aud_inventory` |
| E | شکاف موجودی | `t.inventoryGap` | AUD | Signed. Red if negative |
| F | درصد شکاف | `t.inventoryGapPercent` | % | Signed |

**Tooltip on ارزش موجودی (بهای تمام‌شده):** "مبلغی که واقعاً برای خرید این دلارها پرداخت شده، با نرخ تاریخی هر خرید."  
**Tooltip on ارزش موجودی (بازار):** "ارزش لحظه‌ای موجودی با نرخ خرید امروز."

---

## 7. Section 3 — Liquidity & Accounts

### Account Balance Form
Already implemented (`AccountBalanceForm`). No changes.

### Stat Cards (primary row)

| # | Metric | Source | Unit | Colour logic |
|---|---|---|---|---|
| 1 | موجودی کادوس | `t.kadoosBalanceIRT` | IRT | Neutral |
| 2 | موجودی پژمان | `t.pezhmanBalanceIRT` | IRT | Neutral |
| 3 | کل نقدینگی ایران | `t.totalIranLiquidityIRT` | IRT | Red if < min_irt_liquidity, Green otherwise |
| 4 | ارزش صافی کسب‌وکار | `a.netBusinessValueIRT` | IRT | Green if ≥ 0, Red if < 0 |
| 5 | Cash Runway (نقد) | `t.liquidRunwayMonths` | months | Red < target, Amber < 2×target, Green ≥ 2×target |

### Expandable Detail Panel — Runway ← **UPDATED**

Triggered by "جزئیات Runway ▾"

| # | Metric | Source | Unit | Notes |
|---|---|---|---|---|
| A | Cash Runway (نقد خالص) | `t.liquidRunwayMonths` | months | IRT only / `totalIranLiquidityIRT / avgMonthlyExpenses` |
| B | Cash Runway (شامل موجودی) | `t.totalRunwayMonths` | months | IRT + inventory / `(iranLiquidity + inventoryMarketValue) / avgMonthlyExpenses` |
| C | هزینه ماهانه میانگین | derived from `a.monthlyExpenses` | IRT | Used as denominator for both runways |

**Tooltip on نقد خالص:** "تعداد ماه‌هایی که می‌توان هزینه‌ها را فقط از موجودی نقدی ایران پوشش داد."  
**Tooltip on شامل موجودی:** "تعداد ماه‌ها با فروش کل موجودی دلار به نرخ بازار + نقدینگی ایران."

**Tooltips on stat cards:**
| Card | Tooltip |
|---|---|
| کل نقدینگی ایران | حداقل مورد نیاز: {min_irt_liquidity} تومان |
| Cash Runway | هدف: {cash_runway_target_months} ماه |

---

## 8. Section 4 — Exposure ← **NEW DEDICATED SECTION**

*Previously, exposure was implicit in alerts. Now it gets its own section for full dual-metric visibility.*

### Section Header
- Title: "مواجهه ارزی"
- Description: "نسبت دارایی دلار به کل سبد دارایی‌ها — بر اساس بهای تمام‌شده و ارزش بازار"

### Stat Cards

| # | Metric | Source | Unit | Colour logic |
|---|---|---|---|---|
| 1 | مواجهه (بازار) | `t.exposureMarketBasis` | % | Green = near target, Red > max, Amber if diverging |
| 2 | مواجهه (بهای تمام‌شده) | `t.exposureCostBasis` | % | Same logic |
| 3 | هدف مواجهه | `settings.target_exposure_ratio` | % | Neutral (reference value) |
| 4 | حداکثر مواجهه | `settings.max_aud_exposure` | % | Neutral (reference value) |

**Colour logic for exposure cards:**
```
if (ratio > max_aud_exposure)               → Red     (over limit)
if (ratio > max_aud_exposure × 0.85)        → Amber   (approaching limit)
if (abs(ratio − target) < 0.05)             → Green   (near target)
else                                        → Neutral
```

### Exposure Visual Gauge ← **NEW**

A horizontal bar (not a chart library — pure CSS/HTML):
```
0%      [target]     [max]      100%
 |────────●───────────|──────────|
         50%         80%
         ▲
    [current market basis]
```
- Filled portion = `exposureMarketBasis × 100%`
- Target marker at `target_exposure_ratio`
- Max marker at `max_aud_exposure`
- Colour of filled region: green if below target, amber if between target and max, red if above max

**Tooltip on gauge:** "شاخص بازار (خط پررنگ) = موجودی دلار × نرخ امروز ÷ (موجودی دلار × نرخ + نقدینگی ایران)"

### Trend Indicators on Exposure Cards ← **NEW**
- Source: `strategy.trendAnalysis.exposureTrend`
- Display: small inline badge `↗` / `→` / `↘`

---

## 9. Section 5 — Profitability (was Section 4)

### Stat Cards (primary row — no change to existing 6 cards)

| # | Metric | Source | Unit | Colour logic |
|---|---|---|---|---|
| 1 | سود تجاری بسته‌شده | `a.realizedTradingProfit` | IRT | Green ≥ 0, Red < 0 |
| 2 | درآمد کارمزد | `a.feeIncomeIRT` | IRT | Always green |
| 3 | هزینه‌های پرداخت‌شده | `a.paidExpensesIRT` | IRT | Always red |
| 4 | سود عملیاتی ★ | `a.operatingProfit` | IRT | Green ≥ 0, Red < 0; highlighted border |
| 5 | سود/زیان دفتری | `a.unrealizedPL` | IRT | Green ≥ 0, Amber < 0 |
| 6 | سود خالص کل ★ | `a.totalProfit` | IRT | Green ≥ 0, Red < 0; highlighted border |

### Trend Indicators ← **NEW**
- On سود عملیاتی card: `strategy.trendAnalysis.profitabilityTrend` → `↗` / `→` / `↘`

### Tooltips
| Card | Tooltip |
|---|---|
| سود تجاری بسته‌شده | "سود واقعی از فروش دلار = مبلغ دریافتی ریال − (تعداد دلار فروخته‌شده × WAC در زمان فروش)" |
| سود/زیان دفتری | "ارزش لحظه‌ای موجودی با نرخ امروز منهای بهای تمام‌شده. تا زمان فروش، فقط کاغذی است." |
| هزینه‌های پرداخت‌شده | tooltip sub-line already shows `pending: {pendingExpensesIRT}` if > 0 |

### Expenses Panel
Already implemented (`ExpenseForm`). **New:** Add `exchange_rate` field to the form (for AUD expenses).

---

## 10. Section 6 — Owner Capital (was Section 5)

### Stat Cards

| # | Metric | Source | Unit | Colour logic |
|---|---|---|---|---|
| 1 | مانده وام مالک | `a.ownerLoanBalanceIRT` | IRT | Amber if > 0, Green if = 0, Red if < 0 (overpaid) |
| 2 | ارزش کل دارایی | `a.totalAssetValueIRT` | IRT | Accent (always) |
| 3 | ارزش صافی کسب‌وکار ★ | `a.netBusinessValueIRT` | IRT | Green ≥ 0, Red < 0; highlighted border |

### Tooltips
| Card | Tooltip |
|---|---|
| مانده وام مالک | "مجموع تزریق‌های مالک منهای بازپرداخت‌ها. این مبلغ جزء بدهی کسب‌وکار است." |
| ارزش صافی | "= ارزش کل دارایی − مانده وام مالک. آنچه واقعاً متعلق به کسب‌وکار است." |

### Owner Loans Panel
Already implemented (`OwnerLoanForm`). **New:** Add `exchange_rate` field to the form (for AUD loans).

---

## 11. Section 7 — Settings ← **NEW (Collapsible)**

### Layout
- Collapsed by default, expanding `<details>` or client `useState`
- Header: "تنظیمات خزانه‌داری ⚙" with a subtle "ویرایش" button

### Form fields (all already exist in `TreasurySettingsForm` component)
| Field | Label | Default |
|---|---|---|
| `min_aud_inventory` | حداقل موجودی دلار | 5,000 |
| `target_aud_inventory` | هدف موجودی دلار | 30,000 |
| `max_aud_inventory` | حداکثر موجودی دلار | 150,000 |
| `min_irt_liquidity` | حداقل نقدینگی ایران | 4,000,000,000 |
| `max_aud_exposure` | حداکثر مواجهه | 80% |
| `target_exposure_ratio` ← **NEW field** | هدف مواجهه | 50% |
| `inventory_coverage_target_days` | هدف پوشش روزانه | 14 روز |
| `cash_runway_target_months` | هدف Cash Runway | 3 ماه |
| `recommendation_sensitivity` | حساسیت توصیه | متوسط |

---

## 12. Trend Indicators — Global Rules

### Where trend indicators appear

| Location | Source field | Badge style |
|---|---|---|
| Recommendation card badge row | `trendAnalysis.healthScoreTrend` | Inline pill |
| Health score card | `hs.trend` | Below category badge |
| موجودی دلار stat card | `trendAnalysis.inventoryTrend` | Small suffix on value |
| کل نقدینگی ایران stat card | `trendAnalysis.liquidityTrend` | Small suffix on value |
| مواجهه (بازار) stat card | `trendAnalysis.exposureTrend` | Small suffix on value |
| سود عملیاتی stat card | `trendAnalysis.profitabilityTrend` | Small suffix on value |

### Trend badge rendering
```tsx
// Example: trend badge next to a metric value
<span className={s.trendBadge} data-trend={trend}>
  {trend === "improving" ? "↗" : trend === "declining" ? "↘" : "→"}
</span>
```

### CSS colour for trend badges
| Trend | Color |
|---|---|
| `improving` | `#10b981` (emerald) |
| `stable` | `var(--text-dim)` |
| `declining` | `#ef4444` (red) |

### Tooltip on any trend badge
"روند مقایسه با آخرین تصویر ذخیره‌شده. در صورت عدم وجود سابقه، «پایدار» نشان داده می‌شود."

---

## 13. Full Tooltip Inventory

All tooltips render as the existing `tooltipHint` CSS class (small dim text below the metric label). No hover-only tooltips are required — all hints are permanently visible in the card subtext area.

| Component | Tooltip text (FA) |
|---|---|
| Action badge | "این توصیه فقط بر اساس وضعیت داخلی خزانه است." |
| Health score circle | "امتیاز ترکیبی ۰–۱۰۰ از ۵ شاخص وزن‌دار." |
| Trend badge (anywhere) | "مقایسه با آخرین تصویر ذخیره‌شده." |
| موجودی دلار | هدف: {target} \| حداقل: {min} \| حداکثر: {max} |
| WAC | سود هر دلار: {currentRate − WAC} تومان |
| نسبت موجودی | {gap} {direction} هدف ({gapPct}%) |
| پوشش روزانه | هدف: {target_days} روز |
| ارزش موجودی (بهای تمام‌شده) | "مبلغ واقعی پرداخت‌شده با نرخ تاریخی هر خرید." |
| ارزش موجودی (بازار) | "ارزش لحظه‌ای با نرخ خرید امروز." |
| Cash Runway (نقد) | "ماه‌های پوشش هزینه از نقدینگی ایران." |
| Cash Runway (موجودی) | "ماه‌های پوشش با فروش کل موجودی + نقدینگی." |
| مواجهه (بازار) | هدف: {target_pct}% \| حداکثر: {max_pct}% |
| نرخ خرید پیشنهادی (delta) | "جهت جذب فرستندگان دلار." |
| نرخ فروش پیشنهادی (delta) | "جهت افزایش سود در خروجی‌ها." |
| سود/زیان دفتری | "تا زمان فروش، فقط روی کاغذ است." |
| مانده وام مالک | "بدهی کسب‌وکار به مالک. وارد هیچ فرمول سودی نمی‌شود." |
| Accounting warning items | "این هشدارها از موتور حسابداری صادر شده‌اند. برای رفع، نرخ تاریخی ثبت کنید." |

---

## 14. Section 8 — Reconciliation (FUTURE — Architecture Only)

> **Do not implement. Define architecture and UI placement only.**

### Purpose
Reconciliation verifies that the computed snapshot values match the actual bank/wallet balances for each account. It detects discrepancies between what the engine calculates and what the account actually holds.

### Accounts in Scope
| Account | Currency | Role |
|---|---|---|
| Kadoos | IRT | Primary Iran liquidity account |
| Pezhman | IRT | Secondary Iran liquidity account |
| Zarman | AUD | Australian AUD holding account |

### UI Placement
- Positioned as Section 8, the last section on the page
- **Collapsed by default** — `<details>` element, no JS required
- Header: "تطبیق حساب‌ها (آشتی) 🔄"
- Shows: "این بخش در دست توسعه است." in collapsed state

### Architecture Spec (for future developer)

#### Data inputs per account
| Input | Source |
|---|---|
| Computed IRT balance (Kadoos) | `t.kadoosBalanceIRT` (from `treasury_settings`) |
| Computed IRT balance (Pezhman) | `t.pezhmanBalanceIRT` (from `treasury_settings`) |
| Computed AUD inventory (Zarman) | `a.audInventory` (from ledger WAC calc) |
| Actual Kadoos balance | User-entered OR fetched from bank API |
| Actual Pezhman balance | User-entered OR fetched from bank API |
| Actual Zarman AUD balance | User-entered OR fetched from bank API |

#### Reconciliation record structure (DB — future migration)
```sql
CREATE TABLE account_reconciliations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name    text NOT NULL CHECK (account_name IN ('kadoos','pezhman','zarman')),
  reconciled_at   timestamptz NOT NULL DEFAULT now(),
  computed_value  numeric(18,2) NOT NULL,  -- from engine
  actual_value    numeric(18,2) NOT NULL,  -- manually entered
  discrepancy     numeric(18,2) GENERATED ALWAYS AS (actual_value - computed_value) STORED,
  notes           text,
  reconciled_by   uuid REFERENCES auth.users(id)
);
```

#### UI layout (future implementation)
```
RECONCILIATION SECTION
├── Kadoos Card
│   ├── Computed: {kadoosBalanceIRT} تومان
│   ├── Actual:   [input field]
│   ├── Gap:      {actual − computed} تومان ← red if non-zero
│   └── [ثبت تطبیق] button
│
├── Pezhman Card
│   ├── Computed: {pezhmanBalanceIRT} تومان
│   ├── Actual:   [input field]
│   ├── Gap:      {actual − computed} تومان
│   └── [ثبت تطبیق] button
│
└── Zarman Card
    ├── Computed: {audInventory} AUD  (per WAC engine)
    ├── Actual:   [input field]
    ├── Gap:      {actual − computed} AUD
    └── [ثبت تطبیق] button
```

#### Reconciliation history panel (future)
- Table of past reconciliations: date, account, computed, actual, discrepancy, reconciled_by
- Filterable by account
- Discrepancy ≠ 0 rows highlighted in amber/red

#### Server action signature (future)
```typescript
submitReconciliation(payload: {
  account: "kadoos" | "pezhman" | "zarman";
  computedValue: number;
  actualValue: number;
  notes?: string;
}): Promise<{ success: true } | { error: string }>
```

#### Alert integration (future)
- If `|discrepancy / computedValue| > 0.01` on last reconciliation → emit a `warning` treasury alert
- If `|discrepancy / computedValue| > 0.05` → emit `critical` alert

---

## 15. Mobile Layout Summary

| Section | Mobile behaviour |
|---|---|
| Top bar | Sticky, compact. Critical + warning badge counts only. |
| Zone A (warnings) | Full width collapsed panel. Tap to expand. |
| Zone B (alerts) | Full width stacked list. |
| Section 1 | Recommendation card stacked above health score (full width each). Rate adjustment and forecast below, full width. |
| Section 2 | 2-column grid for stat cards. Expand panel below. |
| Section 3 | Account balance form full width. 2-col stat cards. |
| Section 4 | Exposure cards 2-col. Gauge full width. |
| Section 5 | 2-col stat cards. Expenses panel full width accordion. |
| Section 6 | 2-col stat cards. Owner loans panel full width accordion. |
| Section 7 | Settings collapsed full width. |
| Section 8 | Collapsed stub. |

---

## 16. Desktop Layout Summary

| Section | Desktop behaviour |
|---|---|
| Top bar | Sticky. Full title + badge row. |
| Zone A | Collapsed banner across full content width. |
| Zone B | Alert list, full content width. |
| Section 1 | 60/40 split: Recommendation + Health Score. Rate adjustment full width. Forecast full width (4-col velocity grid). |
| Section 2 | 4–5 col stat card grid. Expand panel inline below. |
| Section 3 | Account balance form. 5-col stat card grid. |
| Section 4 | 4-col exposure cards + full-width gauge. |
| Section 5 | 3-col stat grid. Expenses panel in full-width table. |
| Section 6 | 3-col stat grid. Owner loans panel in full-width table. |
| Section 7 | Collapsible settings panel. |
| Section 8 | Collapsible stub. |

---

## 17. Implementation Checklist (for Phase 5)

After approval, implement in this order:

- [ ] **Zone A:** Accounting warnings banner (collapsible, amber)
- [ ] **Top bar:** Accounting warning count badge
- [ ] **S1-B:** Rate Adjustment Card (new component or inline JSX)
- [ ] **S1-C:** Forecast card: add `buyVelocity30d` and `netVelocity` cells
- [ ] **Section 1:** Trend badges on recommendation badge row and health score
- [ ] **Section 2:** Expandable inventory detail panel (cost vs market values, gap metrics)
- [ ] **Section 3:** Dual runway in expandable detail
- [ ] **Section 4:** New Exposure section (dual cards + CSS gauge + trend badge)
- [ ] **Section 5:** Trend badge on operating profit card + `exchange_rate` field in ExpenseForm
- [ ] **Section 6:** `exchange_rate` field in OwnerLoanForm
- [ ] **Section 7:** Collapsible settings section (move existing settings form here)
- [ ] **Section 8:** Collapsed reconciliation stub (placeholder only)
- [ ] **CSS:** All new classes in `Treasury.module.css`
- [ ] **Errors:** `get_errors` on all modified files before declaring done

---

*Document version: 1.0 — awaiting approval before implementation begins.*
