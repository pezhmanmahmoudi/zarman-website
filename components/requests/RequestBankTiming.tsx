import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import { DEFAULT_REQUEST_SETTINGS } from "@/lib/requests/validation";
import { ChevronDown } from "lucide-react";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import compact from "@/styles/requests/RequestPayment.module.css";

type Props = {
  request?: ExchangeRequest;
  locale: RequestLocale;
  fundingCurrency?: "AUD" | "IRT";
  iranBankingNotice?: string;
  iranBankingNoticeFa?: string;
  review?: boolean;
  australianClearanceMinutes?: number;
};

export function RequestBankTiming({ request, locale, fundingCurrency, iranBankingNotice, iranBankingNoticeFa, review = false, australianClearanceMinutes }: Props) {
  const fa = locale === "fa";
  const advisory = fa
    ? iranBankingNoticeFa || request?.quote.policy_snapshot.iran_banking_notice_fa
    : iranBankingNotice || request?.quote.policy_snapshot.iran_banking_notice;
  const defaultAdvisory = fa ? DEFAULT_REQUEST_SETTINGS.iran_banking_notice_fa : DEFAULT_REQUEST_SETTINGS.iran_banking_notice;
  const priority = !request || request.service_tier === "priority";
  const incomingAud = (request?.quote.funding_currency || fundingCurrency || "AUD") === "AUD";
  
  if (review) {
    const clearanceHours = australianClearanceMinutes ? Math.ceil(australianClearanceMinutes / 60) : null;
    return (
      <details className={compact.reviewDisclosure}>
        <summary className={compact.reviewTitle}>
          <span className={compact.reviewTitleContent}>
            <DashboardLottieScene name="announcement" size={40} />
            <span>{fa ? "نکات مهم زمان‌بندی بانکی" : "Important Bank Timing Notes"}</span>
          </span>
          <ChevronDown className={compact.reviewChevron} size={18} aria-hidden="true" />
        </summary>
        <div className={compact.reviewBody}>
          {incomingAud ? (
            <ul className={compact.timingList}>
              <li>
                <strong>{fa ? "مبدأ (استرالیا): " : "Origin (Australia): "}</strong>
                {fa 
                  ? <>انتقال وجه از حساب استرالیایی معمولاً سریع است؛ اما واریزهای اول یا بررسی‌های امنیتی بانک ممکن است {clearanceHours ? `${new Intl.NumberFormat("fa-IR").format(clearanceHours)} ساعت یا بیشتر` : "مدت بیشتری"} زمان ببرند.</> 
                  : <>Australian transfers can be fast, but first-time payments or bank security checks may take {clearanceHours ? `${clearanceHours} hours or more` : "longer"} to clear.</>}
              </li>
              <li>
                <strong>{fa ? "شروع پردازش: " : "Processing Start: "}</strong>
                {fa 
                  ? "رسید بانکی به‌تنهایی تأییدیه وصول وجه نیست. زمان پردازش پس از نشستن قطعی پول در حساب زرمان آغاز می‌شود." 
                  : "A bank receipt does not guarantee cleared funds. Processing starts only after funds settle in Zarman’s account."}
              </li>
              <li>
                <strong>{fa ? "مقصد (ایران): " : "Destination (Iran): "}</strong>
                {fa 
                  ? "واریز تومان تابع چرخه‌های پایا و ساتنا، ساعات کاری و تعطیلات رسمی بانک‌های ایران است و مستقل از زمان پردازش پلتفرم محاسبه می‌شود." 
                  : "Toman deposits depend on Iran’s Paya and Satna clearing cycles, local banking hours and holidays, independently of platform processing time."}
              </li>
            </ul>
          ) : (
            <ul className={compact.timingList}>
              <li>
                <strong>{fa ? "مبدأ (ایران): " : "Origin (Iran): "}</strong>
                {fa 
                  ? "واریز تومان به حساب ما تابع چرخه‌های پایا و ساتنا، ساعات کاری و تعطیلات رسمی بانک‌های ایران است." 
                  : "Toman deposits to our account depend on Iran’s Paya and Satna clearing cycles, local banking hours, and holidays."}
              </li>
              <li>
                <strong>{fa ? "شروع پردازش: " : "Processing Start: "}</strong>
                {fa 
                  ? "رسید بانکی به‌تنهایی تأییدیه وصول وجه نیست. زمان پردازش پس از نشستن قطعی پول در حساب زرمان آغاز می‌شود." 
                  : "A bank receipt does not guarantee cleared funds. Processing starts only after funds settle in Zarman’s account."}
              </li>
              <li>
                <strong>{fa ? "مقصد (استرالیا): " : "Destination (Australia): "}</strong>
                {fa 
                  ? <>واریز وجه به حساب استرالیایی گیرنده معمولاً سریع است؛ اما در برخی موارد و بررسی‌های امنیتی ممکن است {clearanceHours ? `${new Intl.NumberFormat("fa-IR").format(clearanceHours)} ساعت یا بیشتر` : "مدت بیشتری"} زمان ببرد.</> 
                  : <>Australian transfers to the recipient are usually fast, but security checks may take {clearanceHours ? `${clearanceHours} hours or more` : "longer"} to clear.</>}
              </li>
            </ul>
          )}
          {incomingAud && advisory && advisory !== defaultAdvisory && (
            <p className={compact.timingAdvisory}>{advisory}</p>
          )}
        </div>
      </details>
    );
  }

  return (
    <div className={compact.timing}>
      <p>
        {priority
          ? (fa 
              ? "زمان پردازش سرویس اولویت‌دار، پس از تأیید وصول وجه و تکمیل بررسی‌ها آغاز می‌شود." 
              : "Priority processing starts after cleared funds and required checks are confirmed.")
          : (fa 
              ? "زمان پردازش تراکنش از لحظهٔ تأیید وصول وجه آغاز می‌شود." 
              : "Processing begins as soon as the cleared payment is verified.")}
      </p>
      <details className={compact.details}>
        <summary>{fa ? "نکات مهم زمان‌بندی بانکی" : "Important Bank Timing Notes"}</summary>
        <div className={compact.detailsBody}>
          <p>
            {incomingAud
              ? (fa 
                  ? "انتقال وجه از استرالیا معمولاً سریع است؛ اما واریزهای اول ممکن است ۲۴ ساعت یا بیشتر زمان ببرد." 
                  : "Australian payments are usually fast, but first-time transfers may take 24 hours or longer.")
              : (fa 
                  ? "زمان وصول پرداخت تومانی به حساب ما تابع چرخه‌های بانکی (مانند پایا و ساتنا) است. پردازش پس از نشستن قطعی پول آغاز می‌شود." 
                  : "Incoming Toman deposits depend on bank clearing cycles (like Paya/Satna). We process once funds are fully cleared.")}
          </p>
          <p>
            {fa 
              ? "رسید بانکی به‌تنهایی به معنای تأیید نهایی وصول وجه نیست." 
              : "A bank receipt does not guarantee cleared funds."}
          </p>
          <p>
            {incomingAud
              ? (fa 
                  ? "واریز تومان به حساب گیرنده تابع چرخه‌های پایا و ساتنا و تعطیلات بانکی است، که مجزا از زمان پردازش ما محاسبه می‌شود." 
                  : "Toman deposits depend on Paya/Satna cycles and bank holidays, independent of our processing time.")
              : (fa 
                  ? "انتقال وجه به حساب استرالیایی گیرنده معمولاً سریع است؛ اما در برخی موارد ممکن است ۲۴ ساعت یا بیشتر زمان ببرد." 
                  : "The AUD payout to the recipient is usually fast, but security checks may take 24 hours or longer.")}
          </p>
          {advisory && <p>{advisory}</p>}
        </div>
      </details>
    </div>
  );
}