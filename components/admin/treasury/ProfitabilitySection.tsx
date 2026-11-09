import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { fmtAUD, fmtIRT, fmtRate } from "@/lib/accounting-engine";
import { EXPENSE_CATEGORY_FA } from "@/lib/treasury-utils";
import { profitPeriodHref } from "@/lib/treasury-navigation";
import type { MoneyLine, ProfitStatement } from "@/lib/profit-statement";
import s from "@/styles/admin/ProfitStatement.module.css";

const RECENT_MONTHS = 12;
const AGREEMENT_TOLERANCE_AUD = 0.01;

function Amount({ value, format, min }: { value: number; format: (value: number) => string; min: number }) {
  const shown = Math.abs(value) < min ? 0 : value;
  return <span className={shown < 0 ? s.negative : undefined}>{format(shown)}</span>;
}

const Aud = ({ value }: { value: number }) => <Amount value={value} format={fmtAUD} min={0.005} />;
const Irt = ({ value }: { value: number }) => <Amount value={value} format={fmtIRT} min={0.5} />;

function Row({ label, hint, line, kind }: { label: string; hint?: string; line: MoneyLine; kind?: "subtotal" | "total" }) {
  return (
    <tr className={kind ? s[kind] : undefined}>
      <th scope="row">{label}{hint && <small>{hint}</small>}</th>
      <td><Aud value={line.aud} /></td>
      <td><Irt value={line.irt} /></td>
    </tr>
  );
}

function MoneyTable({ first, children }: { first: string; children: ReactNode }) {
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th scope="col">{first}</th><th scope="col">دلار (AUD)</th><th scope="col">تومان</th></tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Fact({ label, hint, line }: { label: string; hint: string; line: MoneyLine }) {
  return (
    <div className={s.fact}>
      <dt>{label}</dt>
      <dd><strong><Aud value={line.aud} /> <span className={s.unit}>AUD</span></strong><span className={s.factToman}><Irt value={line.irt} /> تومان</span></dd>
      <small>{hint}</small>
    </div>
  );
}

const hasValue = (line: MoneyLine) => Math.abs(line.aud) >= 0.005 || Math.abs(line.irt) >= 0.5;

export default function ProfitabilitySection({ statement: st }: { statement?: ProfitStatement | null }) {
  if (!st) {
    return <p className={s.empty}>برای ساختن صورت سود، نرخ خرید معتبر و نرخ ثبت آورده مالک لازم است. بخش هشدارهای خزانه را بررسی کنید.</p>;
  }
  const { lines, owner, balances, expenses, checks } = st;
  const isAll = st.period === "all";
  const totalExpenses = { aud: -lines.expenses.aud, irt: -lines.expenses.irt };
  const agrees = Math.abs(checks.balancesDifferenceAUD) < AGREEMENT_TOLERANCE_AUD && Math.abs(checks.stockDifferenceAUD) < AGREEMENT_TOLERANCE_AUD;
  const ledgerHref = `/admin/ledger?type=adjustment${st.from ? `&start=${st.from}&end=${st.to}` : ""}`;

  return (
    <div className={s.page}>
      <nav className={s.periods} aria-label="دوره صورت سود">
        {[{ value: "all", label: "کل دوره" }, ...st.months.slice(0, RECENT_MONTHS)].map(option => (
          <Link key={option.value} href={profitPeriodHref(option.value)} prefetch={false}
            aria-current={option.value === st.period ? "page" : undefined}
            className={`${s.period} ${option.value === st.period ? s.periodActive : ""}`}>{option.label}</Link>
        ))}
      </nav>

      <section className={s.hero} aria-labelledby="profit-net">
        <div className={s.headline}>
          <span id="profit-net" className={s.headlineLabel}>سود خالص · {st.periodLabel}</span>
          <strong className={st.net.aud < 0 ? s.headlineLoss : s.headlineGain}>{fmtAUD(st.net.aud)} <span className={s.unit}>AUD</span></strong>
          <span className={s.headlineToman}>معادل <Irt value={st.net.irt} /> تومان، با نرخ خرید {fmtRate(st.closingRate)}</span>
          {Math.abs(st.rateSensitivityAUD) >= 1 && (
            <p>هر {fmtRate(1000)} تومان بالا رفتن نرخ، این سود را حدود {fmtRate(Math.abs(st.rateSensitivityAUD))} دلار {st.rateSensitivityAUD < 0 ? "کم" : "زیاد"} می‌کند؛ چون بخشی از دارایی‌ها تومانی است.</p>
          )}
        </div>
        <dl className={s.facts}>
          <Fact label="سود محقق‌شده" hint="قطعی؛ با معامله یا پرداخت بسته شده" line={st.realized} />
          <Fact label="سود محقق‌نشده" hint="دفتری؛ تا فروش موجودی قطعی نیست" line={st.paper} />
          <Fact label="هزینه‌ها" hint="پرداخت‌شده در این دوره" line={totalExpenses} />
          <Fact label="مانده پس از برداشت مالک" hint="سود خالص منهای برداشت‌ها" line={owner.retained} />
        </dl>
      </section>

      {!agrees && (
        <div className={s.alert} role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <p>
            عددهای این صفحه با هم نمی‌خوانند:
            {Math.abs(checks.balancesDifferenceAUD) >= AGREEMENT_TOLERANCE_AUD && <> اختلاف جمع حساب‌ها با خالص دارایی <Aud value={checks.balancesDifferenceAUD} /> دلار.</>}
            {Math.abs(checks.stockDifferenceAUD) >= AGREEMENT_TOLERANCE_AUD && <> اختلاف موجودی دلار با حساب‌های دلاری <Aud value={checks.stockDifferenceAUD} /> دلار.</>}
            {" "}قبل از تصمیم‌گیری، سطرهای لجر را بررسی کنید.
          </p>
        </div>
      )}

      <section className={s.card}>
        <h3>این سود از کجا آمده؟</h3>
        <MoneyTable first="شرح">
          <Row label="سود معاملات" hint="فروش دلار نسبت به بهای خرید (WAC)" line={lines.trading} />
          <Row label="کارمزد دریافتی" line={lines.fees} />
          <Row label="هزینه‌ها و کارمزد انتقال" hint="دلار با نرخ پایان دوره؛ تومان با نرخ روز پرداخت" line={lines.expenses} />
          <Row label="سود عملیاتی" line={lines.operating} kind="subtotal" />
          <Row label="سود/زیان ارزی" hint="تفاوت نرخ روی دلارهایی که غیر از معامله خارج شدند، مثل برداشت مالک و هزینه دلاری" line={lines.realizedFx} />
          {hasValue(lines.unpaidExpenses) && <Row label="هزینه‌های پرداخت‌نشده" hint="ثبت شده ولی هنوز پرداخت نشده" line={lines.unpaidExpenses} />}
          <Row label="اصلاحات دستی و سایر" hint="سطرهای تطبیق حساب و اصلاحی؛ نه معامله‌اند نه آورده" line={lines.adjustments} />
          <Row label="اثر رشد دلار" hint="بخشی از سود تومانی فقط از بالا رفتن نرخ می‌آید و به دلار سود نیست" line={lines.rateEffect} />
          <Row label="سود محقق‌شده" line={st.realized} kind="subtotal" />
          <Row label="سود دفتری موجودی" hint="فاصله نرخ خرید با WAC روی دلارهای موجود؛ تا فروش قطعی نیست" line={lines.inventory} />
          {hasValue(lines.translation) && <Row label="تسعیر بدهی‌های ارزی" hint="اثر نرخ روی بدهی‌های ارزی پرداخت‌نشده" line={lines.translation} />}
          <Row label="سود خالص" line={st.net} kind="total" />
        </MoneyTable>
        <p className={s.note}>به روش تومانی (بر پایه بهای خرید)، سود این دوره <Irt value={st.tomanCostBasisProfitIRT} /> تومان است. این عدد رشد دلار روی آورده مالک را هم سود حساب می‌کند؛ برای همین عدد اصلی دلاری است.</p>
      </section>

      <div className={s.columns}>
        <section className={s.card}>
          <h3>سود کجا رفته؟</h3>
          <MoneyTable first="شرح">
            <Row label="سود خالص" line={st.net} />
            <Row label="برداشت مالک" hint="برداشت هزینه نیست؛ فقط مانده را کم می‌کند" line={{ aud: -owner.withdrawn.aud, irt: -owner.withdrawn.irt }} />
            <Row label="مانده پس از برداشت" line={owner.retained} kind="subtotal" />
            <Row label="آورده مالک" line={owner.contributed} />
            {!isAll && <Row label="خالص دارایی ابتدای دوره" line={owner.openingNetAssets} />}
            <Row label="خالص دارایی پایان دوره" line={owner.closingNetAssets} kind="total" />
          </MoneyTable>
          <p className={s.note}>ستون تومان در این جدول با نرخ {fmtRate(st.closingRate)} تبدیل شده است.</p>
        </section>

        <section className={s.card}>
          <h3>{isAll ? "پول الان کجاست؟" : "پول در پایان دوره کجا بود؟"}</h3>
          <MoneyTable first="حساب">
            <Row label="بانک‌های دلاری" line={balances.audBanks} />
            <Row label="بانک‌های تومانی" line={balances.irtBanks} />
            {hasValue(balances.transit) && <Row label="پول در راه" line={balances.transit} />}
            <Row label="مانده حساب مشتری‌ها" line={balances.customers} />
            {hasValue(balances.ownerLoan) && <Row label="وام مالک" line={balances.ownerLoan} />}
            {hasValue(balances.unpaid) && <Row label="هزینه و کارمزد پرداخت‌نشده" line={balances.unpaid} />}
            <Row label="خالص دارایی" line={owner.closingNetAssets} kind="total" />
          </MoneyTable>
          <p className={s.note}>دلار آزاد برای فروش: <Aud value={balances.freeAUD} /> دلار.</p>
        </section>
      </div>

      <div className={s.columns}>
        <section className={s.card}>
          <h3>هزینه‌ها به تفکیک دسته</h3>
          <MoneyTable first="دسته">
            {expenses.categories.map(item => <Row key={item.category} label={EXPENSE_CATEGORY_FA[item.category] ?? item.category} line={item} />)}
            {hasValue(expenses.transferFees) && <Row label="کارمزد انتقال" line={expenses.transferFees} />}
            <Row label="جمع" line={totalExpenses} kind="total" />
          </MoneyTable>
        </section>

        <section className={s.card}>
          <h3>روند ماهانه هزینه‌ها</h3>
          <MoneyTable first="ماه">
            {expenses.months.map(item => <Row key={item.month} label={item.label} line={item} />)}
          </MoneyTable>
        </section>
      </div>

      {st.adjustmentRows.length > 0 && (
        <details className={s.card}>
          <summary>سطرهای اصلاحی این دوره ({st.adjustmentRows.length})</summary>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead><tr><th scope="col">تاریخ و توضیح</th><th scope="col">دلار (AUD)</th><th scope="col">تومان</th></tr></thead>
              <tbody>
                {st.adjustmentRows.map(row => (
                  <tr key={row.id}>
                    <th scope="row">{row.date} · {row.account}{row.notes && <small dir="auto">{row.notes}</small>}</th>
                    <td><Aud value={row.aud} /></td>
                    <td><Irt value={row.irt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link href={ledgerHref} prefetch={false} className={s.link}>مشاهده در لجر</Link>
        </details>
      )}

      {agrees && <p className={s.agreement}><CheckCircle2 size={15} aria-hidden="true" />جمع حساب‌ها با خالص دارایی و موجودی دلار با حساب‌های دلاری می‌خواند.</p>}
    </div>
  );
}
