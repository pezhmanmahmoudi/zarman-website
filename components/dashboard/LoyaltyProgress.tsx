"use client";

import { useId, useState, type CSSProperties } from "react";
import { Check, ChevronLeft, ChevronRight, Crown, Route } from "lucide-react";
import { HoverCard } from "radix-ui";
import { dashboardNumber } from "@/lib/dashboard/numbers";
import type { loyaltyJourney } from "@/lib/dashboard/loyalty";
import styles from "@/styles/dashboard/Loyalty.module.css";

type Journey = ReturnType<typeof loyaltyJourney>;

function Milestone({ level, journey, locale }: { level: number; journey: Journey; locale: "fa" | "en" }) {
  const [open, setOpen] = useState(false), tooltipId = useId();
  const fa = locale === "fa", current = level === journey.level, completed = level < journey.level;
  const next = level === journey.level + 1, final = level === journey.totalLevels;
  const number = (value: number, digits = 0) => dashboardNumber(value, locale, digits);
  const state = current ? "current" : completed ? "completed" : "upcoming";
  const name = fa ? `مرحله ${number(level)}` : `Level ${number(level)}`;
  const status = current ? fa ? "سطح شما" : "Your level" : completed ? fa ? "کسب‌شده" : "Unlocked" : next ? fa ? "هدف بعدی" : "Up next" : fa ? "در پیش رو" : "Ahead";
  const fill = Math.min(1, Math.max(0, journey.approvedVolume / journey.stepVolume - (level - 1)));

  return <li className={styles.milestone} data-state={state} data-next={next || undefined}>
    <span className={styles.segment} aria-hidden="true"><span className={styles.segmentFill} style={{ transform: `scaleX(${fill})` }} /></span>
    <HoverCard.Root open={open} onOpenChange={setOpen} openDelay={120} closeDelay={140}>
      <HoverCard.Trigger asChild>
        <button type="button" className={styles.milestoneButton} aria-current={current ? "step" : undefined}
          aria-label={`${name} · ${status}`} aria-describedby={open ? tooltipId : undefined}
          onClick={() => setOpen(true)} onTouchEnd={() => setOpen(true)}>
          <span className={styles.milestoneDot} aria-hidden="true">{final ? <Crown size={14} strokeWidth={1.8} /> : completed ? <Check size={14} strokeWidth={2.5} /> : number(level)}</span>
          <span className={styles.milestoneLabel}>{name}</span>
          <span className={styles.milestoneStatus}>{current ? fa ? "سطح شما" : "You" : next ? fa ? "بعدی" : "Next" : "\u00a0"}</span>
        </button>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content id={tooltipId} role="tooltip" side="top" sideOffset={10} collisionPadding={16}
          dir={fa ? "rtl" : "ltr"} className={styles.tooltip}>
          <span className={styles.tooltipHeading}>{name}<span>{status}</span></span>
          <strong>{final ? fa ? "بهترین نرخ‌های باشگاه" : "The club’s best rates" : fa ? "نرخ بهتر برای خرید و فروش" : "Better rates, both ways"}</strong>
          <p>{fa
            ? <>با <bdi>{number(level * journey.stepVolume)}</bdi> دلار استرالیا تبادلات تأییدشده، {current || completed ? "این سطح را کسب کرده‌اید و از نرخ‌های ویژهٔ آن بهره‌مندید." : "این سطح و نرخ‌های ویژهٔ آن برای شما فعال می‌شود."}</>
            : <>At <bdi>{number(level * journey.stepVolume)} AUD</bdi> in approved exchanges, {current || completed ? "you’ve earned this level and enjoy its preferential rates." : "you unlock this level and its preferential buy and sell rates."}</>}</p>
          <HoverCard.Arrow className={styles.tooltipArrow} width={14} height={7} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  </li>;
}

export function LoyaltyProgress({ journey, locale, motionEnabled }: {
  journey: Journey; locale: "fa" | "en"; motionEnabled: boolean;
}) {
  const [browsedStart, setBrowsedStart] = useState<number | null>(null);
  const fa = locale === "fa", { level, totalLevels, maxed, remaining, progress } = journey;
  const number = (value: number, digits = 0) => dashboardNumber(value, locale, digits);
  const lastStart = Math.max(1, totalLevels - 3);
  const start = Math.min(lastStart, Math.max(1, browsedStart ?? level - 1));
  const levels = Array.from({ length: Math.min(4, totalLevels) }, (_, index) => start + index);
  const end = levels.at(-1) ?? 0;
  const progressText = maxed
    ? fa ? "شما در بالاترین سطح وفاداری هستید!" : "You’re at the highest loyalty level!"
    : fa ? `تنها ${number(remaining, 2)} دلار استرالیا تا سطح بعدی فاصله دارید.` : `Only ${number(remaining, 2)} AUD left to unlock the next tier.`;

  if (!totalLevels) return <p className={styles.progressHint}>{fa ? "مزایای باشگاه مشتریان در این بخش نمایش داده می‌شود." : "Your loyalty benefits will appear here."}</p>;

  return <section className={styles.journey} dir={fa ? "rtl" : "ltr"} data-maxed={maxed || undefined} data-motion={motionEnabled}>
    <div className={styles.journeyHeading}>
      <span className={styles.journeyTitle}>
        <span className={styles.journeyEmblem} aria-hidden="true">{maxed ? <Crown size={16} strokeWidth={1.7} /> : <Route size={16} strokeWidth={1.7} />}</span>
        <span>{fa ? "مسیر وفاداری شما" : "Your loyalty journey"}</span>
      </span>
      <span className={styles.levelBadge}>{fa ? `سطح ${number(level)} از ${number(totalLevels)}` : `Level ${number(level)} of ${number(totalLevels)}`}</span>
    </div>
    <div role="progressbar" className="sr-only" aria-label={fa ? "مسیر وفاداری تا بالاترین سطح" : "Loyalty journey to the highest level"}
      aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={progressText} />
    <ol className={styles.milestones} style={{ "--milestone-count": levels.length } as CSSProperties}
      aria-label={fa ? "مراحل وفاداری؛ برای مشاهدهٔ مزایا، هر مرحله را انتخاب کنید" : "Loyalty levels; select a level to view its benefits"}>
      {levels.map(value => <Milestone key={value} level={value} journey={journey} locale={locale} />)}
    </ol>
    {totalLevels > 4 && <nav className={styles.levelNavigation} aria-label={fa ? "مرور مراحل وفاداری" : "Browse loyalty levels"}>
      <button type="button" disabled={start === 1} onClick={() => setBrowsedStart(Math.max(1, start - 4))} aria-label={fa ? "مراحل پیشین" : "Earlier levels"}>{fa ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
      <span>{fa ? `مراحل ${number(start)} تا ${number(end)}` : `Levels ${number(start)}–${number(end)}`}</span>
      <button type="button" disabled={end === totalLevels} onClick={() => setBrowsedStart(Math.min(lastStart, start + 4))} aria-label={fa ? "مراحل بعدی" : "Later levels"}>{fa ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}</button>
    </nav>}
    {maxed ? <div className={styles.capMessage}>
      <span className={styles.capIcon} aria-hidden="true"><Crown size={24} strokeWidth={1.7} /></span>
      <div><strong>{progressText}</strong><p>{fa ? "شما به سقف پاداش‌ها رسیده‌اید و از بهترین نرخ‌ها بهره‌مندید." : "You’ve unlocked every reward and enjoy the club’s best rates."}</p></div>
    </div> : <p className={styles.progressHint} data-private-value>{progressText}</p>}
  </section>;
}
