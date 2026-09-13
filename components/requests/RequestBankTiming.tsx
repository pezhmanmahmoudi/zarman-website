import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import compact from "@/styles/requests/RequestPayment.module.css";

type Props = {
  request?: ExchangeRequest;
  locale: RequestLocale;
  iranBankingNotice?: string;
  iranBankingNoticeFa?: string;
};

export function RequestBankTiming({ request, locale, iranBankingNotice, iranBankingNoticeFa }: Props) {
  const fa = locale === "fa";
  const advisory = fa
    ? iranBankingNoticeFa || request?.quote.policy_snapshot.iran_banking_notice_fa
    : iranBankingNotice || request?.quote.policy_snapshot.iran_banking_notice;
  const priority = !request || request.service_tier === "priority";
  return <div className={compact.timing}>
    <p>{priority
      ? (fa ? "زمان اولویت پس از تأیید وصول وجه و تکمیل بررسی‌ها شروع می‌شود." : "Priority timing starts after cleared funds and required checks are confirmed.")
      : (fa ? "رسید واریز پس از وصول وجه تأیید می‌شود." : "Payment is confirmed after the funds clear.")}</p>
    <details className={compact.details}>
      <summary>{fa ? "زمان‌بندی بانک‌ها" : "Bank timing"}</summary>
      <div className={compact.detailsBody}>
        <p>{fa ? "وصول وجه در استرالیا ممکن است تا ۲۴ ساعت، و در تعطیلات یا بررسی‌های بانکی بیشتر، طول بکشد. بارگذاری رسید، تأیید وصول وجه نیست." : "Australian transfers may take up to 24 hours, or longer during holidays or bank checks. A receipt does not confirm cleared funds."}</p>
        <p>{fa ? "تسویه در ایران تابع چرخه‌های پایا، ساعات ساتنا و تعطیلات بانکی است؛ زمان رسیدن وجه به حساب گیرنده جدا از زمان رسیدگی است." : "Iranian settlement follows Paya cycles, Satna hours and bank holidays. Arrival in the recipient account is separate from the handling target."}</p>
        {advisory && <p>{advisory}</p>}
      </div>
    </details>
  </div>;
}
