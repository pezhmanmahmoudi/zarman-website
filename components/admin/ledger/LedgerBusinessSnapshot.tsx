import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  Landmark,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import styles from "@/styles/admin/LedgerOverview.module.css";

type LedgerBusinessSnapshotProps = {
  operatingProfit: number;
  periodTradingProfit: number;
  periodFeeIncome: number;
  audInventory: number;
  irtLiquidity: number;
  netBusinessValue: number;
  tradeCount: number;
  tradeVolume: number;
  averageBuyRate: number;
  averageSellRate: number;
  wac: number;
  openingInventory: number;
  audPurchased: number;
  audSold: number;
  closingInventory: number;
};

const fmtIRT = (value: number) => Math.round(value).toLocaleString("en-AU");
const fmtAUD = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 2 });

function Value({ value, currency }: { value: number; currency: "IRT" | "AUD" }) {
  return (
    <bdi className={styles.value} dir="ltr">
      {currency === "AUD" ? fmtAUD(value) : fmtIRT(value)} <small>{currency}</small>
    </bdi>
  );
}

export default function LedgerBusinessSnapshot(props: LedgerBusinessSnapshotProps) {
  const periodGrossProfit = props.periodTradingProfit + props.periodFeeIncome;

  return (
    <section className={styles.snapshot} dir="rtl" aria-labelledby="ledger-snapshot-title">
      <header className={styles.header}>
        <div className={styles.headingIntro}>
          <span className={styles.headingIcon} aria-hidden="true">
            <ChartNoAxesCombined size={20} />
          </span>
          <div className={styles.headingCopy}>
            <div className={styles.headingTitleRow}>
              <h1 id="ledger-snapshot-title">نمای مدیریتی دفتر کل</h1>
              <span className={styles.headingBadge}>خلاصه کسب‌وکار</span>
            </div>
            <p>تصویر یکپارچه سودآوری، نقدینگی و موجودی بر اساس داده‌های دفتر کل</p>
          </div>
        </div>
        <div className={styles.periodMeta}>
          <small>حجم معاملات دوره</small>
          <strong dir="ltr">{fmtAUD(props.tradeVolume)} AUD</strong>
          <span>{props.tradeCount.toLocaleString("en-AU")} معامله تاییدشده</span>
        </div>
      </header>

      <div className={styles.primaryGrid}>
        <article className={`${styles.primaryMetric} ${styles.primaryMetricEmphasis}`}>
          <span className={`${styles.icon} ${props.operatingProfit >= 0 ? styles.iconPositive : styles.iconNegative}`}>
            <TrendingUp size={20} />
          </span>
          <div>
            <span className={styles.label}>سود عملیاتی خالص</span>
            <Value value={props.operatingProfit} currency="IRT" />
            <small className={styles.description}>سود معاملات و کارمزد، پس از هزینه‌های پرداخت‌شده</small>
          </div>
        </article>

        <article className={styles.primaryMetric}>
          <span className={`${styles.icon} ${periodGrossProfit >= 0 ? styles.iconPositive : styles.iconNegative}`}>
            <CircleDollarSign size={20} />
          </span>
          <div>
            <span className={styles.label}>سود ناخالص دوره</span>
            <Value value={periodGrossProfit} currency="IRT" />
            <small className={styles.description}>سود معامله به‌علاوه درآمد کارمزد دوره</small>
          </div>
        </article>

        <article className={styles.primaryMetric}>
          <span className={`${styles.icon} ${styles.iconInfo}`}><WalletCards size={20} /></span>
          <div>
            <span className={styles.label}>موجودی دلار</span>
            <Value value={props.audInventory} currency="AUD" />
            <small className={styles.description}>موجودی واقعی قابل معامله</small>
          </div>
        </article>

        <article className={styles.primaryMetric}>
          <span className={`${styles.icon} ${styles.iconInfo}`}><Landmark size={20} /></span>
          <div>
            <span className={styles.label}>نقدینگی ریالی</span>
            <Value value={props.irtLiquidity} currency="IRT" />
            <small className={styles.description}>موجودی حساب‌های بانکی ایران</small>
          </div>
        </article>

        <article className={styles.primaryMetric}>
          <span className={`${styles.icon} ${styles.iconNeutral}`}><BriefcaseBusiness size={20} /></span>
          <div>
            <span className={styles.label}>ارزش خالص کسب‌وکار</span>
            <Value value={props.netBusinessValue} currency="IRT" />
            <small className={styles.description}>دارایی‌ها پس از کسر مانده وام مالک</small>
          </div>
        </article>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.detailItem}>
          <span><TrendingUp size={15} /> سود معاملات دوره</span>
          <Value value={props.periodTradingProfit} currency="IRT" />
        </div>
        <div className={styles.detailItem}>
          <span><Banknote size={15} /> درآمد کارمزد دوره</span>
          <Value value={props.periodFeeIncome} currency="IRT" />
        </div>
        <div className={styles.detailItem}>
          <span><ArrowDownLeft size={15} /> میانگین نرخ خرید</span>
          <bdi className={styles.value} dir="ltr">{fmtIRT(props.averageBuyRate)}</bdi>
        </div>
        <div className={styles.detailItem}>
          <span><ArrowUpRight size={15} /> میانگین نرخ فروش</span>
          <bdi className={styles.value} dir="ltr">{fmtIRT(props.averageSellRate)}</bdi>
        </div>
        <div className={styles.detailItem}>
          <span><Scale size={15} /> میانگین موزون خرید</span>
          <bdi className={styles.value} dir="ltr">{fmtIRT(props.wac)} <small>IRT</small></bdi>
        </div>
      </div>

      <div className={styles.inventoryFlow} aria-label="گردش موجودی دلار در دوره">
        <div className={styles.flowTitle}>
          <WalletCards size={18} />
          <span><strong>گردش موجودی دلار</strong><small>تطبیق موجودی در دوره انتخاب‌شده</small></span>
        </div>
        <div className={styles.flowEquation}>
          <div><span>ابتدای دوره</span><strong dir="ltr">{fmtAUD(props.openingInventory)} AUD</strong></div>
          <i aria-hidden="true">+</i>
          <div className={styles.flowPositive}><span>خرید دوره</span><strong dir="ltr">{fmtAUD(props.audPurchased)} AUD</strong></div>
          <i aria-hidden="true">−</i>
          <div className={styles.flowNegative}><span>فروش دوره</span><strong dir="ltr">{fmtAUD(props.audSold)} AUD</strong></div>
          <i aria-hidden="true">=</i>
          <div className={styles.flowClosing}><span>موجودی پایان دوره</span><strong dir="ltr">{fmtAUD(props.closingInventory)} AUD</strong></div>
        </div>
      </div>
    </section>
  );
}