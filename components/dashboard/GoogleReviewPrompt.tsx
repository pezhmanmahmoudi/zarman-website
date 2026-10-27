"use client";

import { useEffect, useState } from "react";
import { ArrowUpLeft, ArrowUpRight, Check, RotateCcw, Star } from "lucide-react";
import type { RequestLocale } from "@/lib/requests/types";
import { ZARMAN_GOOGLE_REVIEW_URL } from "@/lib/google-review";
import { cn } from "@/lib/utils";

export { ZARMAN_GOOGLE_REVIEW_URL };
export const GOOGLE_REVIEW_STORAGE_KEY = "zarman:google-review-done";
const GOOGLE_REVIEW_SYNC_EVENT = "zarman:google-review-sync";

type ReviewPromptState = "active" | "thanked" | "hidden";

function readReviewDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GOOGLE_REVIEW_STORAGE_KEY) === "done";
  } catch {
    return false;
  }
}

function writeReviewDone(done: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (done) {
      window.localStorage.setItem(GOOGLE_REVIEW_STORAGE_KEY, "done");
    } else {
      window.localStorage.removeItem(GOOGLE_REVIEW_STORAGE_KEY);
    }
    window.localStorage.removeItem("zarman:google-review-prompt");
    window.dispatchEvent(new CustomEvent(GOOGLE_REVIEW_SYNC_EVENT, { detail: done }));
  } catch {}
}

export function GoogleGIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className={cn("shrink-0", className)}>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z" />
    </svg>
  );
}

/** Calm, high-converting Google Maps review invitation embedded in completed transfer cards. */
export function GoogleReviewPrompt({ locale, className }: { locale: RequestLocale; className?: string }) {
  const fa = locale === "fa", text = (en: string, persian: string) => fa ? persian : en;
  const ExternalArrow = fa ? ArrowUpLeft : ArrowUpRight;
  const [state, setState] = useState<ReviewPromptState>(() => (readReviewDone() ? "hidden" : "active"));

  useEffect(() => {
    const onSync = (event: Event) => {
      const done = (event as CustomEvent<boolean>).detail;
      setState( current => (done ? (current === "thanked" ? "thanked" : "hidden") : "active"));
    };
    window.addEventListener(GOOGLE_REVIEW_SYNC_EVENT, onSync);
    return () => window.removeEventListener(GOOGLE_REVIEW_SYNC_EVENT, onSync);
  }, []);

  if (state === "hidden") return null;

  if (state === "thanked") {
    return (
      <div
        data-feedback-prompt
        data-google-review-prompt="thanked"
        role="status"
        className={cn(
          "mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-[#cdebd9] bg-white/90 px-3.5 py-2.5 text-xs text-[#1d5e3a]",
          className,
        )}
      >
        <span className="inline-flex items-center gap-2 font-medium leading-relaxed">
          <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-[#16a34a] text-white">
            <Check size={12} strokeWidth={2.6} />
          </span>
          <span>
            {text(
              "Thank you for your support! Your review helps Zarman grow, and this box won't be shown again.",
              "سپاس از همراهی شما! نظرتان کمک بزرگی به خانواده زرمان است و این باکس دیگر نمایش داده نمی‌شود.",
            )}
          </span>
        </span>
        <button
          type="button"
          data-undo-google-review
          onClick={() => {
            writeReviewDone(false);
            setState("active");
          }}
          className="inline-flex items-center gap-1 rounded-full border border-[#cdebd9] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15803d] transition-colors hover:bg-[#f0fdf4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/35"
        >
          <RotateCcw size={11} aria-hidden="true" />
          <span>{text("Undo", "برگرداندن")}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      data-feedback-prompt
      data-google-review-prompt="active"
      className={cn(
        "mt-3.5 rounded-2xl border border-[#cdebd9] bg-white/92 p-3.5 shadow-[0_4px_14px_-6px_#0d683218]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_#1a1a2e14] ring-1 ring-[#e7e5f0]">
            <GoogleGIcon size={12} />
          </span>
          <span className="text-xs font-semibold leading-5 text-[#25213e]">
            {text("Happy with this transfer?", "از این انتقال راضی بودید؟")}
          </span>
        </span>
        <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-0.5">
          {[0, 1, 2, 3, 4].map(index => (
            <Star key={index} size={13} strokeWidth={0} fill="currentColor" className="text-[#f5a623] drop-shadow-[0_1px_2px_#f5a62340]" />
          ))}
        </span>
      </div>
      <p className="m-0 mt-1.5 text-[11px] leading-relaxed text-[#575366]">
        {text(
          "Zarman Exchange would love your feedback. Post a review to our Google profile in seconds.",
          "ثبت نظر شما در گوگل مپ تنها چند ثانیه زمان می‌برد و بزرگ‌ترین دلگرمی ماست.",
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          data-already-reviewed-google
          onClick={() => {
            writeReviewDone(true);
            setState("thanked");
          }}
          title={text(
            "Hide this prompt if you have already left a review",
            "در صورت ثبت نظر، با انتخاب این گزینه این پیام دیگر نمایش داده نمی‌شود",
          )}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#e2e8f0] bg-white/80 px-3 py-1.5 text-[11px] font-medium text-[#575366] transition-colors hover:border-[#bbf7d0] hover:bg-[#f0fdf4] hover:text-[#15803d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16a34a]/35"
        >
          <Check size={13} strokeWidth={2.3} aria-hidden="true" className="text-[#16a34a]" />
          <span>{text("Already reviewed", "قبلاً نظر داده‌ام")}</span>
        </button>
        <a
          href={ZARMAN_GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-google-review-link
          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-[#dcd7f4] bg-gradient-to-b from-white to-[#f6f5ff] px-4 py-1.5 text-xs font-semibold text-[#4338ca] no-underline shadow-[0_1px_2px_#1a1a2e0d] outline-none transition-[background-color,border-color,color,box-shadow] duration-150 hover:border-[#bfb6ee] hover:from-[#faf9ff] hover:to-[#eeecff] hover:text-[#312e81] hover:shadow-[0_4px_12px_-4px_#4f46c830] focus-visible:ring-2 focus-visible:ring-[#635bff]/40 motion-reduce:transition-none @sm:w-auto"
        >
          <GoogleGIcon size={14} />
          <span>{text("Post a Review on Google", "ثبت نظر در گوگل مپ")}</span>
          <ExternalArrow size={14} aria-hidden="true" className="shrink-0 opacity-75" />
        </a>
      </div>
    </div>
  );
}

