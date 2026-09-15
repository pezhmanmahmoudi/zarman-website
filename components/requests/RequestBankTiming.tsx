import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import compact from "@/styles/requests/RequestPayment.module.css";

type Props = {
  request?: ExchangeRequest;
  locale: RequestLocale;
  fundingCurrency?: "AUD" | "IRT";
  iranBankingNotice?: string;
  iranBankingNoticeFa?: string;
};

export function RequestBankTiming({ request, locale, fundingCurrency, iranBankingNotice, iranBankingNoticeFa }: Props) {
  const fa = locale === "fa";
  const advisory = fa
    ? iranBankingNoticeFa || request?.quote.policy_snapshot.iran_banking_notice_fa
    : iranBankingNotice || request?.quote.policy_snapshot.iran_banking_notice;
  const priority = !request || request.service_tier === "priority";
  const incomingAud = (request?.quote.funding_currency || fundingCurrency || "AUD") === "AUD";
  return <div className={compact.timing}>
    <p>{priority
      ? (fa ? "زمان اولویت پس از تأیید وصول وجه و تکمیل بررسی‌ها شروع می‌شود." : "Priority timing starts after cleared funds and required checks are confirmed.")
      : (fa ? "پس از بررسی وجه وصول‌شده، دریافت آن تأیید می‌شود." : "Funds are confirmed as soon as the cleared payment is verified.")}</p>
    <details className={compact.details}>
      <summary>{fa ? "زمان‌بندی بانک‌ها" : "Bank timing"}</summary>
      <div className={compact.detailsBody}>
        <p>{incomingAud
          ? (fa ? "پرداخت استرالیایی ممکن است سریع برسد. بعضی واریزهای بار اول یا بررسی‌های بانکی تا ۲۴ ساعت یا بیشتر طول می‌کشند؛ انتظار اجباری ۲۴ ساعته نداریم." : "Australian payments may arrive quickly. Some first-time transfers or bank checks take up to 24 hours, or longer; we do not impose a 24-hour wait.")
          : (fa ? "وصول پرداخت تومانی به زمان پردازش بانک فرستنده بستگی دارد. پس از بررسی وجه وصول‌شده، دریافت آن تأیید می‌شود." : "Incoming Toman payments depend on the sending bank’s processing times. We confirm funds once the cleared payment is verified.")}</p>
        <p>{fa ? "رسید واریز به‌تنهایی تأیید وصول وجه نیست." : "A receipt does not confirm cleared funds."}</p>
        <p>{incomingAud
          ? (fa ? "تسویه در ایران تابع چرخه‌های پایا، ساعات ساتنا و تعطیلات بانکی است؛ زمان رسیدن وجه به حساب گیرنده جدا از زمان رسیدگی است." : "Iranian settlement follows Paya cycles, Satna hours and bank holidays. Arrival in the recipient account is separate from the handling target.")
          : (fa ? "زمان واریز دلار به گیرنده به بانک مقصد و روش پرداخت بستگی دارد." : "The AUD payout to the recipient depends on the receiving bank and payment method.")}</p>
        {advisory && <p>{advisory}</p>}
      </div>
    </details>
  </div>;
}
