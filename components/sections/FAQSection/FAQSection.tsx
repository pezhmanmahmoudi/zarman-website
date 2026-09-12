"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import Link from "next/link";
import { getFaqItems } from "@/data/faq";
import styles from "./FAQSection.module.css";

type DisclosureMotion = { animation: Animation; expanded: boolean; finish: () => void };

/** Every answer renders on the server; motion enhances native disclosures. */
export default function FAQSection({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const sectionRef = useRef<HTMLElement>(null);
  const disclosureMotions = useRef(new Map<HTMLDetailsElement, DisclosureMotion>());

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !window.IntersectionObserver) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const entranceMotions = new Set<Animation>();
    const disclosures = disclosureMotions.current;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reducedMotion.matches || !(entry.target instanceof HTMLElement) || !entry.target.animate) continue;
        const itemIndex = entry.target.dataset.faqIndex;
        const isCard = itemIndex !== undefined;
        const animation = entry.target.animate([
          { opacity: 0, transform: `translateY(${isCard ? 20 : 15}px)${isCard ? " scale(0.98)" : ""}`, filter: "blur(8px)" },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
        ], {
          duration: isCard ? 850 : 800,
          delay: isCard ? 150 + Number(itemIndex) * 100 : entry.target.tagName === "H2" ? 100 : 0,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "backwards",
        });
        entranceMotions.add(animation);
        animation.onfinish = () => entranceMotions.delete(animation);
      }
    }, { threshold: 0.2 });

    // Initial HTML stays visible even when JavaScript or motion is unavailable.
    section.querySelectorAll("[data-faq-reveal]").forEach((element) => observer.observe(element));
    const stopMotion = () => {
      if (!reducedMotion.matches) return;
      entranceMotions.forEach((animation) => animation.cancel());
      entranceMotions.clear();
      disclosures.forEach((motion) => motion.finish());
    };
    reducedMotion.addEventListener("change", stopMotion);
    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", stopMotion);
      entranceMotions.forEach((animation) => animation.cancel());
      disclosures.forEach((motion) => motion.finish());
    };
  }, []);

  function setExpanded(details: HTMLDetailsElement, expanded: boolean) {
    const answer = details.querySelector<HTMLElement>("[data-faq-answer]");
    if (!answer) return;
    const previous = disclosureMotions.current.get(details);
    const startHeight = answer.offsetHeight;
    const startOpacity = details.open ? getComputedStyle(answer).opacity : "0";
    previous?.animation.cancel();
    disclosureMotions.current.delete(details);
    details.dataset.expanded = String(expanded);
    if (expanded) details.open = true;

    if (!answer.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      details.open = expanded;
      return;
    }
    const animation = answer.animate([
      { height: `${startHeight}px`, opacity: startOpacity },
      { height: `${expanded ? answer.scrollHeight : 0}px`, opacity: expanded ? 1 : 0 },
    ], { duration: 300, easing: "ease-in-out" });
    const finish = () => {
      details.open = expanded;
      animation.cancel();
      disclosureMotions.current.delete(details);
    };
    disclosureMotions.current.set(details, { animation, expanded, finish });
    animation.onfinish = finish;
  }

  function toggleAnswer(event: MouseEvent<HTMLElement>) {
    const details = event.currentTarget.parentElement;
    if (!(details instanceof HTMLDetailsElement)) return;
    event.preventDefault();
    const expanded = !(disclosureMotions.current.get(details)?.expanded ?? details.open);
    if (expanded) {
      sectionRef.current?.querySelectorAll("details").forEach((other) => {
        if (other !== details && (disclosureMotions.current.get(other)?.expanded ?? other.open)) setExpanded(other, false);
      });
    }
    setExpanded(details, expanded);
  }

  return (
    <section ref={sectionRef} id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow} data-faq-reveal>
            {isEn ? "Your Questions Answered" : "پاسخ به ابهامات شما"}
          </p>
          <h2 id="faq-title" className={styles.title} data-faq-reveal>
            {isEn ? "Frequently Asked Questions" : "سوالات متداول"}
          </h2>
        </div>

        <div className={styles.faqList}>
          {getFaqItems(locale).map((faq, index) => (
            <details id={`faq-${faq.id}`} key={faq.id} className={styles.faqItem} open={index === 0} data-faq-reveal data-faq-index={index}>
              <summary className={styles.questionBtn} onClick={toggleAnswer}>
                <span className={styles.questionText}>{faq.question}</span>
                <span className={styles.icon} aria-hidden="true" />
              </summary>
              <div className={styles.answerWrapper} data-faq-answer>
                <div className={styles.answerInner}>
                  <p className={styles.answerText}>
                    {faq.answer}
                    {faq.link && <> <Link href={faq.link.href} className={styles.answerLink}>{faq.link.label}</Link></>}
                  </p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
