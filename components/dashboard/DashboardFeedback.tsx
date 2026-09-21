"use client";

import React, { useRef, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";
import { DashboardCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { DashboardMotionIcon } from "@/components/dashboard/DashboardMotionIcon";
import { cn } from "@/lib/utils";

export function DashboardFeedback({ profileId, motionEnabled = true }: { profileId: string; motionEnabled?: boolean }) {
  const locale = useLocale(), isEn = locale === "en";
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const busy = useRef(false);
  const text = (en: string, fa: string) => isEn ? en : fa;
  const ratings = isEn ? ["Needs improvement", "Could be better", "Good", "Very good", "Excellent"] : ["نیازمند بهبود", "می‌تواند بهتر باشد", "خوب", "خیلی خوب", "عالی"];

  const handleSubmitFeedback = async () => {
    if (!profileId || !feedback.trim() || busy.current) return;
    busy.current = true;
    setFeedbackSubmitting(true); setResult("idle"); setFeedbackStatus("");
    try {
      const { error } = await supabase.from("testimonials").insert([{ user_id: profileId, rating, message: feedback.trim(), status: "pending" }]);
      if (error) throw Error("feedback_failed");
      setFeedback(""); setRating(5); setResult("success");
      setFeedbackStatus(text("Your feedback was submitted successfully. Thank you!", "نظر شما با موفقیت ثبت شد. سپاسگزاریم!"));
    } catch {
      setResult("error");
      setFeedbackStatus(text("Couldn’t submit your feedback. Please try again.", "ثبت بازخورد ممکن نشد. لطفاً دوباره تلاش کنید."));
    } finally { busy.current = false; setFeedbackSubmitting(false); }
  };

  return <div className="mx-auto w-full max-w-3xl space-y-6" dir={isEn ? "ltr" : "rtl"}>
    <DashboardPageHeader title={text("Tell us how it went.", "از تجربه‌تان بگویید.")} description={text("Your feedback helps us make the next transfer better.", "بازخورد شما کمک می‌کند انتقال بعدی بهتر باشد.")}/>
    <DashboardCard className="p-6 sm:p-9">
      {result === "success" ? <DashboardReveal motionEnabled={motionEnabled} className="space-y-5"><div className="flex items-center gap-4"><DashboardMotionIcon name="complete" size={64} motionEnabled={motionEnabled}/><StatusBadge tone="success">{text("Feedback received", "بازخورد دریافت شد")}</StatusBadge></div><div role="status"><h2 className="m-0! text-2xl font-semibold text-[#182027]!">{text("Thank you for sharing.", "ممنون که تجربه‌تان را گفتید.")}</h2><p className="mb-0 mt-3 text-sm leading-relaxed text-[#626a76]">{feedbackStatus}</p></div><DashboardButton tone="secondary" onClick={() => {setResult("idle");setFeedbackStatus("");}}>{text("Write another message", "نوشتن پیام دیگر")}</DashboardButton></DashboardReveal> : <form onSubmit={event => {event.preventDefault();void handleSubmitFeedback();}} className="space-y-7">
        <fieldset className="m-0 border-0 p-0" disabled={feedbackSubmitting}><legend className="mb-4 text-base font-medium text-[#182027]">{text("How was your experience?", "تجربه شما چطور بود؟")}</legend><div className="flex flex-wrap items-center gap-1" role="group" aria-label={text("Rating out of five", "امتیاز از پنج")}>{[1,2,3,4,5].map(value => <button key={value} type="button" aria-label={text(`Rate ${value} out of 5`, `امتیاز ${value.toLocaleString("fa-IR")} از ۵`)} aria-pressed={rating === value} onClick={() => setRating(value)} className="grid size-12 place-items-center rounded-xl bg-transparent text-[#977129] outline-none transition-colors hover:bg-[#fff8ea] focus-visible:ring-2 focus-visible:ring-[#635bff]"><Star size={29} strokeWidth={1.6} aria-hidden="true" className={cn(value <= rating ? "fill-[#ecc878] text-[#977129]" : "fill-none text-[#c5cad2]")}/></button>)}</div><p aria-live="polite" className="mb-0 mt-3 text-sm text-[#626a76]">{ratings[rating-1]}</p></fieldset>
        <div><label htmlFor="dashboard-feedback" className="mb-3 block text-sm font-medium text-[#182027]">{text("What would you like us to know?", "چه چیزی می‌خواهید به ما بگویید؟")}</label><textarea id="dashboard-feedback" className={cn(dashboardInputClass,"min-h-40 resize-y leading-relaxed")} placeholder={text("What worked well, or what could be better?", "چه چیزی خوب بود و چه چیزی می‌تواند بهتر شود؟")} value={feedback} onChange={event => setFeedback(event.target.value)} disabled={feedbackSubmitting} required /></div>
        {result === "error" && <p role="alert" className="m-0 text-sm leading-relaxed text-rose-700">{feedbackStatus}</p>}
        <div className="flex justify-end border-t border-[#e9ecf0] pt-6"><DashboardButton type="submit" disabled={!profileId || !feedback.trim() || feedbackSubmitting}>{feedbackSubmitting ? text("Submitting…", "در حال ثبت…") : text("Send feedback", "ارسال بازخورد")}</DashboardButton></div>
      </form>}
    </DashboardCard>
  </div>;
}
