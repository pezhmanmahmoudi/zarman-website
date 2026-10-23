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
    const disclosures = disclosureMotions.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finishDisclosures = () => disclosures.forEach((motion) => motion.finish());
    if (!section || !window.IntersectionObserver || reducedMotion.matches) return finishDisclosures;

    // Hide only what is still below the fold, so nothing already on screen ever
    // blinks out. Initial HTML stays visible even when JavaScript is unavailable.
    const pending = Array.from(section.querySelectorAll<HTMLElement>("[data-faq-reveal]"))
      .filter((element) => element.getBoundingClientRect().top > window.innerHeight);
    pending.forEach((element) => { element.dataset.faqReveal = "pending"; });

    const observer = new IntersectionObserver((entries) => {
      // Stagger within each batch arriving together, never by position in the
      // whole list, so a card scrolled into view never waits as an empty slot.
      let order = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        // Reached from above (jump link, restored scroll): fade in place, don't rise.
        if (entry.boundingClientRect.top < 0) element.style.transform = "none";
        element.style.setProperty("--reveal-delay", `${order++ * 90}ms`);
        element.dataset.faqReveal = "shown";
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    pending.forEach((element) => observer.observe(element));

    const showAll = () => {
      observer.disconnect();
      pending.forEach((element) => { element.dataset.faqReveal = ""; });
    };
    const stopMotion = () => {
      if (!reducedMotion.matches) return;
      showAll();
      finishDisclosures();
    };
    reducedMotion.addEventListener("change", stopMotion);
    return () => {
      reducedMotion.removeEventListener("change", stopMotion);
      showAll();
      finishDisclosures();
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
            <details id={`faq-${faq.id}`} key={faq.id} className={styles.faqItem} open={index === 0} data-faq-reveal>
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
