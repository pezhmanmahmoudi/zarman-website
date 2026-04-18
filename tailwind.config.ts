import type { Config } from "tailwindcss";

const config: Config = {
  // این بخش به تیلویند می‌گوید که دقیقاً داخل کدام فایل‌ها را برای پیدا کردن کلاس‌های CSS بگردد
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./styles/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // اگر در آینده خواستی رنگ‌ها یا فونت‌های اختصاصی تیلویند را تعریف کنی، اینجا قرار می‌گیرد
    },
  },
  plugins: [],
};

export default config;