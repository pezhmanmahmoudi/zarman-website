'use client';
import { useState } from 'react';
import styles from './FAQItem.module.css';

interface FAQItemProps {
  question: string;
  answer: string;
}

export const FAQItem = ({ question, answer }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${styles.faqItem} ${isOpen ? styles.open : ''}`} onClick={() => setIsOpen(!isOpen)}>
      <button className={styles.trigger} aria-expanded={isOpen}>
        <span className={styles.question}>{question}</span>
        <span className={styles.icon}>{isOpen ? '−' : '+'}</span>
      </button>
      <div className={styles.contentWrapper}>
        <p className={styles.answer}>{answer}</p>
      </div>
    </div>
  );
};