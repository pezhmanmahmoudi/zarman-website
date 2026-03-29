import styles from "./TrustStrip.module.css";

const trustItems = [
  {
    title: "نمایش روشن نرخ و مبلغ",
    text: "جزئیات اصلی پیش از ثبت درخواست به‌صورت واضح نمایش داده می‌شود.",
  },
  {
    title: "فرآیند قابل پیگیری",
    text: "مسیر درخواست به‌صورت منظم و مرحله‌به‌مرحله قابل دنبال کردن است.",
  },
  {
    title: "پشتیبانی انسانی",
    text: "در صورت نیاز، ارتباط و پاسخ‌گویی در مراحل مختلف حفظ می‌شود.",
  },
  {
    title: "مناسب کاربران ایران–استرالیا",
    text: "ساختار تجربه با تمرکز بر نیاز کاربران این مسیر طراحی شده است.",
  },
];

export default function TrustStrip() {
  return (
    <section
      id="trust"
      className={styles.section}
      aria-labelledby="trust-strip-title"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <p className={styles.eyebrow}>لایه اول اعتماد</p>
          <h2 id="trust-strip-title" className={styles.title}>
            شفافیت، پیگیری و تجربه‌ای منظم‌تر
          </h2>
        </div>

        <div className={styles.grid}>
          {trustItems.map((item) => (
            <article key={item.title} className={styles.card}>
              <span className={styles.marker} aria-hidden="true" />
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}