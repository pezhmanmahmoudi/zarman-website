import { formatLocalizedNumber } from "@/lib/numbers";
import type { ExchangeRates } from "@/lib/requests/rates";
import type { RequestLocale } from "@/lib/requests/types";

type Props = {
  rates: ExchangeRates;
  locale: RequestLocale;
  rowClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
};

/** Shared definition-list rows for the estimate, accepted quote and invoice. */
export function RequestExchangeRates({ rates, locale, rowClassName, labelClassName, valueClassName }: Props) {
  const fa = locale === "fa";
  const rows = [
    { key: "base", label: rates.original ? (fa ? "نرخ تبدیل اولیه" : "Original exchange rate") : (fa ? "نرخ تبدیل" : "Exchange rate"), value: rates.base },
    { key: "loyalty", label: rates.original ? (fa ? "نرخ وفاداری اولیه" : "Original loyalty rate") : (fa ? "نرخ وفاداری" : "Loyalty rate"), value: rates.loyalty },
  ];
  if (rates.applied !== null && (rates.original || rates.loyalty === null || Math.abs(rates.applied - rates.loyalty) > 0.0000005)) {
    rows.push({ key: "applied", label: rates.original ? (fa ? "نرخ تبدیل اصلاح‌شده" : "Revised exchange rate") : (fa ? "نرخ نهایی" : "Final exchange rate"), value: rates.applied });
  }
  return <>{rows.map(({ key, label, value }) => <div key={key} className={rowClassName} data-exchange-rate={key}>
    <dt className={labelClassName}>{label}</dt>
    <dd className={valueClassName}>{value === null ? "—" : <><bdi dir="ltr" data-number-locale={locale}>{formatLocalizedNumber(value, locale, { maximumFractionDigits: 6 })}</bdi>{" "}{fa ? "تومان" : "Toman"}</>}</dd>
  </div>)}</>;
}
