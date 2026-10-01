"use client";

import React, { useId, useState } from "react";
import { Star, MessageCircleHeart, ShieldCheck, Lightbulb } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/context/LocaleContext";
import { DashboardMagicCard, DashboardButton, DashboardPageHeader, DashboardReveal, StatusBadge, dashboardInputClass } from "@/components/dashboard/dashboard-ui";
import { DashboardMotionIcon } from "@/components/dashboard/DashboardMotionIcon";
import { DashboardLottieScene } from "@/components/dashboard/DashboardLottieScene";
import { DashboardListFooter, DashboardListHeader } from "@/components/dashboard/dashboard-list";
import { cn } from "@/lib/utils";

export function DashboardFeedback({ profileId, motionEnabled = true }: { profileId: string; motionEnabled?: boolean }) {
  const locale = useLocale(), isEn = locale === "en";
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const starGradientId = `feedback-star-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const shownRating = hoverRating ?? rating;
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [submittedRating, setSubmittedRating] = useState<number | null>(null);
  const text = (en: string, fa: string) => isEn ? en : fa;
  const ratings = isEn ? ["Needs improvement", "Could be better", "Good", "Very good", "Excellent"] : ["نیازمند بهبود", "می‌تواند بهتر باشد", "خوب", "خیلی خوب", "عالی"];
  const ratingTones = ["bg-[#fff1f2] text-[#be123c]", "bg-[#fff4ea] text-[#c2410c]", "bg-[#fff8e6] text-[#a15c07]", "bg-[#ecfdf3] text-[#067647]", "bg-[#ecfdf3] text-[#067647]"];
  const reasons = [
    { Icon: Lightbulb, tile: "linear-gradient(145deg,#ffc35a,#ff8f1f)", glow: "#ff8f1f", en: "Helps us continuously improve the platform", fa: "کمک به بهبود مستمر امکانات پلتفرم" },
    { Icon: ShieldCheck, tile: "linear-gradient(145deg,#4ade80,#16a34a)", glow: "#16a34a", en: "Reviewed directly by the Zarman team, not bots", fa: "بررسی مستقیم توسط کارشناسان زرمان، نه ربات‌ها" },
    { Icon: MessageCircleHeart, tile: "linear-gradient(145deg,#8b7dff,#5b4cf0)", glow: "#5b4cf0", en: "Takes less than a minute", fa: "ثبت نظر در کمتر از یک دقیقه" },
  ];

  const handleSubmitFeedback = async () => {
    if (!profileId || !feedback.trim() || feedbackSubmitting) return;
    setFeedbackSubmitting(true); setResult("idle"); setFeedbackStatus("");
    try {
      const { error } = await supabase.from("testimonials").insert([{ user_id: profileId, rating, message: feedback.trim(), status: "pending" }]);
      if (error) throw Error("feedback_failed");
      setSubmittedRating(rating);
      setFeedback(""); setRating(5); setResult("success");
      setFeedbackStatus(text("Our team will review your feedback and use it to improve your next transfers.", "کارشناسان ما نظر شما را بررسی می‌کنند و از آن برای بهتر شدن انتقال‌های بعدی شما استفاده می‌کنند."));
    } catch {
      setResult("error");
      setFeedbackStatus(text("Couldn’t submit your feedback. Please try again.", "ثبت بازخورد ممکن نشد. لطفاً دوباره تلاش کنید."));
    } finally { setFeedbackSubmitting(false); }
  };

  return <div className="min-w-0 space-y-6 sm:space-y-7" dir={isEn ? "ltr" : "rtl"}>
    <DashboardPageHeader title={text("How was your experience with Zarman?", "تجربه شما با زرمان چگونه بود؟")} description={text("Your feedback helps us improve our service for your future transfers.", "نظرات شما به ما کمک می‌کند کیفیت خدماتمان را برای انتقال‌های بعدی شما ارتقا دهیم.")}/>
    {result === "success" ? <DashboardMagicCard tone="emerald" pointerEffect={false} motionEnabled={motionEnabled} contentClassName="p-6 sm:p-10">
      <DashboardReveal motionEnabled={motionEnabled} className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        {submittedRating === 5
          ? <DashboardLottieScene name="feedback-heart" size={104} motionEnabled={motionEnabled}/>
          : <DashboardMotionIcon name="complete" size={72} motionEnabled={motionEnabled}/>}
        <StatusBadge tone="success">{text("Feedback received", "بازخورد دریافت شد")}</StatusBadge>
        <div role="status"><h2 className="m-0! text-2xl font-semibold text-[#182027]!">{text("Thank you for your feedback.", "از بازخورد شما سپاسگزاریم.")}</h2><p className="mb-0 mt-3 text-sm leading-relaxed text-[#626a76]">{feedbackStatus}</p></div>
        <DashboardButton tone="secondary" onClick={() => {setResult("idle");setFeedbackStatus("");setSubmittedRating(null);}}>{text("Submit another feedback", "ثبت بازخورد دیگر")}</DashboardButton>
      </DashboardReveal>
    </DashboardMagicCard> : <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
      <DashboardMagicCard tone="violet" motionEnabled={motionEnabled} contentClassName="p-0 sm:p-0" data-feedback-form>
        <DashboardListHeader title={text("Your rating and comments", "امتیاز و نظر شما")} description={text("Choose a rating, then tell us about your experience in a few lines.", "امتیاز دهید و تجربه خود را در چند خط برای ما بنویسید.")} scene="feedback-review" motionEnabled={motionEnabled} />
        <form onSubmit={event => {event.preventDefault();void handleSubmitFeedback();}}>
          <div className="flex flex-col gap-7 border-t border-[#ebe7f3] bg-white/80 px-5 py-6 sm:px-7 sm:py-7">
            <fieldset className="m-0 border-0 p-0" disabled={feedbackSubmitting}>
              <legend className="mb-2 text-sm font-semibold text-[#1d1d1f]">{text("Rate our service", "امتیاز شما به خدمات زرمان")}</legend>
              <svg aria-hidden="true" width="0" height="0" className="absolute"><defs><linearGradient id={starGradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd76a"/><stop offset="100%" stopColor="#ff9f1a"/></linearGradient></defs></svg>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="-ms-2 flex items-center" role="group" aria-label={text("Rating out of five", "امتیاز از پنج")} onPointerLeave={() => setHoverRating(null)}>{[1,2,3,4,5].map(value => {
                  const on = value <= shownRating;
                  return <button key={value} type="button" aria-label={text(`Rate ${value} out of 5`, `امتیاز ${value.toLocaleString("fa-IR")} از ۵`)} aria-pressed={rating === value} onClick={() => setRating(value)} onPointerEnter={event => { if (event.pointerType === "mouse") setHoverRating(value); }} className="group/star grid size-12 place-items-center rounded-full bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#635bff]/40 sm:size-14">
                    <Star aria-hidden="true" strokeWidth={1.3} fill={on ? `url(#${starGradientId})` : "#f1f2f6"} className={cn("size-9 transition-[transform,color,filter] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] sm:size-10", on ? "text-[#f29a12] drop-shadow-[0_6px_10px_#ff9f1a40]" : "text-[#d4d8e1]", motionEnabled && "motion-safe:group-hover/star:-rotate-12 motion-safe:group-hover/star:scale-[1.18] motion-safe:group-active/star:scale-95")}/>
                  </button>;
                })}</div>
                <p aria-live="polite" className={cn("m-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors", ratingTones[rating-1])}><span aria-hidden="true" className="size-1.5 rounded-full bg-current"/>{ratings[rating-1]}</p>
              </div>
            </fieldset>
            <div><label htmlFor="dashboard-feedback" className="mb-3 block text-sm font-semibold text-[#1d1d1f]">{text("Share your thoughts and suggestions", "نظرات و پیشنهادات خود را با ما در میان بگذارید")}</label><textarea id="dashboard-feedback" className={cn(dashboardInputClass,"min-h-40 resize-y border-[#e7e9f0] bg-[#f7f8fb] leading-relaxed transition-[border-color,box-shadow,background-color] focus:border-[#8b7dff] focus:bg-white focus:ring-4 focus:ring-[#635bff]/10")} placeholder={text("What did you like, and where can we improve?", "چه مواردی رضایت‌بخش بود و در چه بخش‌هایی می‌توانیم بهتر عمل کنیم؟")} value={feedback} onChange={event => setFeedback(event.target.value)} disabled={feedbackSubmitting} required /></div>
            {result === "error" && <p role="alert" className="m-0 text-sm leading-relaxed text-rose-700">{feedbackStatus}</p>}
          </div>
          <DashboardListFooter>
            <span className="text-xs leading-6 text-[#66617a]">{text("After review, your feedback may appear in the customer reviews on our website.", "نظر شما پس از بررسی ممکن است در بخش نظرات مشتریان وب‌سایت نمایش داده شود.")}</span>
            <DashboardButton type="submit" className="w-full sm:w-auto" disabled={!profileId || !feedback.trim() || feedbackSubmitting}>{feedbackSubmitting ? text("Submitting…", "در حال ثبت…") : text("Submit Feedback", "ثبت بازخورد")}</DashboardButton>
          </DashboardListFooter>
        </form>
      </DashboardMagicCard>
      <DashboardMagicCard tone="sky" motionEnabled={motionEnabled} contentClassName="p-5 sm:p-6" data-feedback-reasons>
        <h2 className="m-0! text-base! font-semibold leading-snug! text-[#1d1d1f]!">{text("Why your feedback matters", "چرا بازخورد شما ارزشمند است؟")}</h2>
        <ul className="m-0 mt-5 list-none space-y-4 p-0">{reasons.map(({ Icon, tile, glow, en, fa }) => <li key={en} className="flex items-center gap-3 text-sm leading-6 text-[#4a5262]"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[11px] text-white" style={{ background: tile, boxShadow: `0 6px 14px -6px ${glow}99, inset 0 1px 0 #ffffff40` }}><Icon size={17} strokeWidth={2}/></span><span>{text(en, fa)}</span></li>)}</ul>
      </DashboardMagicCard>
    </div>}
  </div>;
}
