import type { ExchangeRequest, RequestLocale } from "@/lib/requests/types";
import styles from "@/styles/requests/Requests.module.css";

export function RequestBankTiming({ request, locale, iranBankingNotice }: { request?: ExchangeRequest; locale: RequestLocale; iranBankingNotice?: string }) {
  const fa = locale === "fa";
  const advisory = iranBankingNotice || request?.quote.policy_snapshot.iran_banking_notice;
  return <div className={styles.timingNote}>
    <strong>{fa ? "زمان واریز و تسویه بانکی" : "Bank clearance and settlement timing"}</strong>
    <p>{fa ? "انتقال بانکی استرالیا ممکن است تا ۲۴ ساعت و بسته به بانک، تعطیلات یا بررسی‌ها بیشتر طول بکشد. رسید آپلودشده به معنی دریافت وجه نیست." : "Australian bank transfers may take up to 24 hours, or longer depending on the bank, holidays or checks. Uploading a receipt does not confirm that funds have cleared."}</p>
    <p>{fa ? "تسویه در ایران به چرخه‌های پایا، ساعات کاری ساتنا و تعطیلات بانکی وابسته است. زمان رسیدن وجه به گیرنده جدا از هدف زمانی رسیدگی است." : "Iranian settlement depends on Paya clearing cycles, Satna operating hours and bank holidays. Arrival in the recipient account is separate from our handling target."}</p>
    {advisory && <p lang="en" dir="ltr">{advisory}</p>}
    {(!request || request.service_tier === "priority") && <p><strong>{fa ? "هدف زمانی اولویت فقط پس از تأیید دریافت وجه توسط تیم مالی و تکمیل بررسی‌ها شروع می‌شود؛ نه هنگام ثبت درخواست یا آپلود رسید." : "The Priority time target starts only after staff confirm cleared funds and required checks are complete, not at submission or receipt upload."}</strong></p>}
  </div>;
}
