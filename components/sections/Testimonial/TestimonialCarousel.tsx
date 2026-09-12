"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Star } from "lucide-react";
import styles from "./TestimonialSection.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export interface Review {
  name: string;
  text: string;
  rating: number;
}

const QuoteIcon = () => (
  <svg className={styles.quoteSvg} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M10 11C10 13.2091 8.20914 15 6 15C3.79086 15 2 13.2091 2 11V7H6C8.20914 7 10 8.79086 10 11ZM22 11C22 13.2091 20.2091 15 18 15C15.7909 15 14 13.2091 14 11V7H18C20.2091 7 22 8.79086 22 11Z" fill="currentColor" />
  </svg>
);

const ReviewCard = ({ review }: { review: Review }) => (
  <figure className={styles.card}>
    <div className={styles.cardHeaderFlex}>
      <div className={styles.cardRating}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={16} fill={star <= review.rating ? "currentColor" : "none"} className={star <= review.rating ? styles.starFilled : styles.starEmpty} />
        ))}
      </div>
      <QuoteIcon />
    </div>

    <blockquote className={styles.textWrap}>
        <p className={styles.text} dir="auto">{review.text}</p>
    </blockquote>

    <figcaption className={styles.authorBox}>
      <div className={styles.avatar} aria-hidden="true">
        {review.name.charAt(0).toUpperCase()}
      </div>

      <div className={styles.authorInfo}>
        <h4 className={styles.name} dir="auto">{review.name}</h4>
      </div>
    </figcaption>
  </figure>
);

export default function TestimonialCarousel({ locale, reviews }: { locale: string; reviews: Review[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const isEn = locale === "en";
  const stats = {
    avg: reviews.length ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : 0,
    total: reviews.length,
  };
  const rotate = (arr: Review[], by: number) => [...arr.slice(by), ...arr.slice(0, by)];
  const offset = Math.max(1, Math.floor(reviews.length / 3));
  const col1 = reviews;
  const col2 = rotate(reviews, offset);
  const col3 = rotate(reviews, offset * 2);

  useGSAP(() => {
    const el = sectionRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 }, scrollTrigger: { trigger: el, start: "top 75%" } });
    tl.fromTo(`.${styles.header} > *`, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, stagger: 0.15 })
      .fromTo(`.${styles.carouselMask}`, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 1.2 }, "-=0.4");
  }, { scope: sectionRef });

  return (
    <section className={styles.section} ref={sectionRef} aria-labelledby="test-title">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>{isEn ? "What Our Users Say" : "تجربه کاربران"}</span>
          <h2 id="test-title" className={styles.title}>{isEn ? "Trust We've Built" : "اعتمادی که ساخته‌ایم"}</h2>

          <div className={styles.headerStats}>
            <div className={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} fill={star <= Math.round(stats.avg) ? "currentColor" : "none"} className={styles.headerStar} />
              ))}
            </div>
            <span className={styles.statsText}>
              {isEn
                ? <><strong>{stats.avg.toLocaleString("en-AU")} out of 5</strong> (based on {stats.total.toLocaleString("en-AU")} reviews)</>
                : <><strong>{stats.avg.toLocaleString("fa-IR")} از ۵</strong> (بر اساس {stats.total.toLocaleString("fa-IR")} نظر ثبت شده)</>}
            </span>
          </div>
        </div>

        <div className={styles.carouselMask}>
          <div className={styles.columnsContainer}>
            <div className={styles.column}>
              <div className={`${styles.track} ${styles.scrollUp}`}>{col1.map((r, i) => <ReviewCard key={`c1-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">{col1.map((r, i) => <ReviewCard key={`c1-b-${i}`} review={r} />)}</div>
            </div>
            <div className={styles.column} aria-hidden="true">
              <div className={`${styles.track} ${styles.scrollDown}`}>{col2.map((r, i) => <ReviewCard key={`c2-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollDown}`} aria-hidden="true">{col2.map((r, i) => <ReviewCard key={`c2-b-${i}`} review={r} />)}</div>
            </div>
            <div className={styles.column} aria-hidden="true">
              <div className={`${styles.track} ${styles.scrollUp}`}>{col3.map((r, i) => <ReviewCard key={`c3-a-${i}`} review={r} />)}</div>
              <div className={`${styles.track} ${styles.scrollUp}`} aria-hidden="true">{col3.map((r, i) => <ReviewCard key={`c3-b-${i}`} review={r} />)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}