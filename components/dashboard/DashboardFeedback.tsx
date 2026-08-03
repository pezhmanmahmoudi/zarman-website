import React, { useState } from "react";
import { Star, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import styles from "@/styles/dashboard/DashboardFeedback.module.css";
import cardStyles from "@/styles/dashboard/DashboardCards.module.css";
import { useLocale } from "@/context/LocaleContext";

export function DashboardFeedback({ profileId }: { profileId: string }) {
  const locale = useLocale();
  const isEn = locale === "en";
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const persianRatingDigits = ["۱", "۲", "۳", "۴", "۵"];

  const handleSubmitFeedback = async () => {
    if (!profileId || !feedback.trim() || feedbackSubmitting) return;
    try {
      setFeedbackSubmitting(true); setFeedbackStatus(isEn ? "Submitting..." : "در حال ثبت...");
      const { error } = await supabase.from("testimonials").insert([{ user_id: profileId, rating, message: feedback.trim(), status: "pending" }]);
      if (error) { setFeedbackStatus(isEn ? "Failed to submit feedback. Please try again." : "خطا در ثبت نظر. لطفاً دوباره تلاش کنید."); return; }
      setFeedback(""); setRating(5); setFeedbackStatus(isEn ? "Your feedback was submitted successfully. Thank you!" : "نظر شما با موفقیت ثبت شد. سپاسگزاریم!");
    } finally { setFeedbackSubmitting(false); }
  };

  return (
    <article className={`${cardStyles.panelCard} ${styles.feedbackCard}`}>
      <div className={styles.feedbackHeader}>
        <h2 className={styles.feedbackTitle}>{isEn ? "Rate Zarman Exchange Services" : "ارزیابی خدمات زرمان اکسچنج"}</h2>
        <p className={styles.feedbackText}>{isEn ? "Your experience and feedback help us improve our financial services quality." : "تجربه و بازخورد شما ضامن ارتقای کیفیت خدمات مالی ماست."}</p>
      </div>
      <div className={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            aria-label={isEn ? `Rate ${s} out of 5` : `ثبت امتیاز ${persianRatingDigits[s - 1]} از ۵`}
            className="inline-flex bg-transparent p-0 border-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded-sm"
          >
            <Star size={44} aria-hidden="true" className={`${styles.starBtn} ${s <= rating ? styles.starActive : styles.starOff}`} />
          </button>
        ))}
      </div>
      <textarea className={styles.feedbackTextarea} placeholder={isEn ? "Share your suggestions, concerns, or satisfaction here..." : "پیشنهادات، انتقادات یا رضایت خود را در این کادر بنویسید..."} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      <div className={styles.feedbackActions}>
        <button className={cardStyles.primaryButton} onClick={handleSubmitFeedback} disabled={!feedback.trim() || feedbackSubmitting} type="button">
          {feedbackSubmitting
            ? <><span className={cardStyles.spinner} aria-hidden="true" /> {isEn ? "Submitting..." : "در حال ثبت..."}</>
            : <><Send size={20} /> {isEn ? "Submit Feedback" : "ثبت نهایی بازخورد در سیستم"}</>}
        </button>
        {feedbackStatus && <p className={styles.feedbackStatus}>{feedbackStatus}</p>}
      </div>
    </article>
  );
}
