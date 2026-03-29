"use client";
import React from "react";
import { motion } from "framer-motion";
import styles from "./AboutUs.module.css";
import WaveVisuals from "./WaveVisuals";

export default function AboutUs() {
  return (
    <section className={styles.sectionContainer} id="liquidity-section">
      <div className={styles.contentWrapper}>
        
        {/* WAVE VISUAL - Left Side */}
        <motion.div 
          className={styles.visualContainer}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1.5 }}
        >
          <WaveVisuals />
        </motion.div>

        {/* TEXT CONTENT - Right Side (RTL) */}
        <div className={styles.textContainer} dir="rtl">
          <motion.span 
            className={styles.highlightText}
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            سرعت و نقدینگی
          </motion.span>

          <motion.h2 
            className={styles.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            جریان پایدار سرمایه در <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-purple-400 to-blue-400">
              شبکه هوشمند زرمان
            </span>
          </motion.h2>

          <motion.p 
            className={styles.description}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            در دنیای پرشتاب امروز، زمان مهم‌ترین دارایی شماست. زرمان با بهره‌گیری از الگوریتم‌های پیشرفته، جریان نقدینگی را به گونه‌ای مدیریت می‌کند که انتقالات مالی شما بین استرالیا و ایران در سریع‌ترین زمان ممکن و با نرخ‌های رقابتی انجام شود.
          </motion.p>

          <motion.div 
            className="mt-12 flex gap-6"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <button className="px-10 py-4 bg-white text-black font-black rounded-full hover:bg-purple-500 hover:text-white transition-all duration-300">
              مشاهده نرخ لحظه‌ای
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}