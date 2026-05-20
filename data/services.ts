export interface Service {
  slug: string;
  locale: "en" | "fa";
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  description: string;
  bodyHtml: string;
}

export const services: Service[] = [
  // ──────────────────────────── ENGLISH ────────────────────────────────────
  {
    slug: "student-remittance",
    locale: "en",
    title: "Student Remittance",
    metaTitle: "Student Remittance Australia to Iran | Tuition & Visa Fees | Zarman Exchange",
    metaDescription: "Pay Australian university tuition fees, OSHC insurance, visa charges and student living costs from Iran. AUSTRAC-registered. Zero fees. Best AUD/IRT rate.",
    h1: "AUD Remittance for Students Migrating to Australia",
    description:
      "Focus on your studies — let Zarman handle every cross-border payment. Tuition, visa, accommodation, OSHC insurance and more, at the best rate with zero hidden fees.",
    bodyHtml: `
<h2>Who Is This Service For?</h2>
<p>Iranian students studying in Australia, or families in Iran supporting students, who need to make regular AUD payments including tuition fees, OSHC health insurance, student visa charges, and accommodation deposits.</p>

<h2>What Payments Are Covered?</h2>
<ul>
  <li><strong>University tuition fees</strong> — direct payment to any Australian institution</li>
  <li><strong>OSHC health insurance</strong> — required for all student visa holders</li>
  <li><strong>Student visa application fees</strong> — paid to the Department of Home Affairs</li>
  <li><strong>Accommodation and living costs</strong> — rent bonds, utilities, general living expenses</li>
  <li><strong>English language test fees</strong> — IELTS, PTE, TOEFL</li>
</ul>

<h2>Why Use Zarman for Student Payments?</h2>
<p>Student payments often have strict deadlines set by universities. Zarman's fast settlement means your payment arrives on time, with an official receipt emailed immediately upon confirmation. Our volume-based loyalty pricing also means that as your cumulative transfers grow, your personalised rate improves automatically.</p>

<h2>How to Get Started</h2>
<p><a href="/en/register">Register a free account</a>, complete identity verification (required by Australian law under AUSTRAC AML/CTF rules), and submit your first transaction request. Our support team is available on WhatsApp for any questions.</p>
`,
  },
  {
    slug: "healthcare-professional-payments",
    locale: "en",
    title: "Healthcare Professional Payments",
    metaTitle: "AUD Payments for Healthcare Professionals Migrating to Australia | Zarman",
    metaDescription: "Pay AMC, PESCI, ADC, NCLEX, OSCE, OET, and AHPRA registration fees from Iran. Fast, fee-free AUD remittance for doctors, dentists, nurses and allied health professionals.",
    h1: "AUD Payments for Healthcare Professionals Registering in Australia",
    description:
      "Every step of the AHPRA registration journey involves AUD payments. Zarman handles them all — AMC, PESCI, OET, AHPRA fees — with zero transaction fees and same-day processing.",
    bodyHtml: `
<h2>Who Is This Service For?</h2>
<p>Iranian doctors, dentists, nurses, pharmacists and allied health professionals going through the Australian registration process who need to make AUD payments for exams, assessments and registration bodies.</p>

<h2>Covered Exam and Registration Fees</h2>
<ul>
  <li><strong>AMC (Australian Medical Council)</strong> — MCQ and clinical examination fees</li>
  <li><strong>PESCI (Performance and Skills Assessment)</strong> — specialist pathway assessment</li>
  <li><strong>ADC (Australian Dental Council)</strong> — written and practical exam fees</li>
  <li><strong>NCLEX / OSCE</strong> — nursing registration examination fees</li>
  <li><strong>OET (Occupational English Test)</strong> — language proficiency test for healthcare</li>
  <li><strong>AHPRA registration fees</strong> — annual registration with the Australian Health Practitioner Regulation Agency</li>
</ul>

<h2>Why Timing Matters</h2>
<p>Many healthcare exam registrations have payment deadlines tied to exam booking windows. A delayed or rejected payment can mean waiting another 6–12 months. Zarman prioritises healthcare professional payments for same-day processing.</p>

<h2>Get Started</h2>
<p><a href="/en/register">Create your account</a> and submit your first payment request. Our team understands the AHPRA registration process and can help you identify the exact payee details for each body.</p>
`,
  },
  {
    slug: "capital-and-asset-transfer",
    locale: "en",
    title: "Capital & Asset Transfer",
    metaTitle: "Large Capital Transfer Australia Iran | Property Sale Proceeds | Zarman Exchange",
    metaDescription: "Transfer large sums — property sale proceeds, family inheritance, or personal capital — between Australia and Iran securely. AUSTRAC-registered. Enterprise-grade compliance.",
    h1: "Secure Large Capital & Asset Transfers Between Australia and Iran",
    description:
      "Forget the stress of moving large sums. Zarman provides a secure, fast settlement platform for personal capital, property sale proceeds, and family asset transfers — protecting the value of your wealth across the AUD/IRT corridor.",
    bodyHtml: `
<h2>When Do You Need This?</h2>
<p>Large cross-border transfers arise in several situations: selling property in Iran or Australia, repatriating family inheritance, transferring savings when relocating, or consolidating family assets across the two countries.</p>

<h2>How Zarman Handles Large Transfers</h2>
<p>For transfers above standard retail thresholds, Zarman provides a dedicated account manager who quotes a personalised rate based on the transaction volume. Our loyalty pricing means larger amounts receive progressively better rates. All large transactions are processed under Zarman's full AUSTRAC AML/CTF compliance framework.</p>

<h2>Compliance and Documentation</h2>
<p>All large capital transfers require supporting documentation (source-of-funds declaration) as required under Australian AML/CTF rules. Zarman's compliance team guides you through each requirement so the process is clear and efficient.</p>

<h2>Start a Large Transfer</h2>
<p><a href="/en/register">Register</a> and complete KYC verification, then contact our team directly via WhatsApp to discuss your transfer requirements and receive a personalised quote.</p>
`,
  },
  {
    slug: "business-payment-infrastructure",
    locale: "en",
    title: "Business Payment Infrastructure",
    metaTitle: "B2B AUD/IRT Payment Infrastructure | Offset Settlement | Zarman Exchange",
    metaDescription: "Streamline cross-border business payments between Australia and Iran. Offset settlement, netting positions, and enterprise AUD/IRT liquidity management via Zarman Exchange.",
    h1: "Enterprise AUD/IRT Payment Infrastructure for Businesses",
    description:
      "Facilitate commercial transactions and manage cross-border liquidity with a focus on speed. Zarman's offset settlement system allows businesses to net positions across the AUD/IRT corridor, reducing cost and settlement time.",
    bodyHtml: `
<h2>What Is Offset Settlement?</h2>
<p>Rather than routing every payment through traditional correspondent banking channels, Zarman's offset system matches flows in opposite directions within the AUD/IRT corridor. This eliminates intermediary costs and dramatically reduces settlement time.</p>

<h2>Use Cases</h2>
<ul>
  <li><strong>Import/export payments</strong> — settling invoices between Australian and Iranian trading partners</li>
  <li><strong>Service contracts</strong> — paying Iranian contractors or suppliers from Australian accounts</li>
  <li><strong>Payroll</strong> — salary payments for staff in either jurisdiction</li>
  <li><strong>Liquidity management</strong> — managing treasury positions across the two markets</li>
</ul>

<h2>Enterprise Onboarding</h2>
<p>Business clients undergo enhanced due diligence as required by AUSTRAC. Zarman assigns a dedicated relationship manager for all enterprise accounts. <a href="/en/register">Register your business</a> or contact us to discuss your specific requirements.</p>
`,
  },

  // ──────────────────────────── PERSIAN ────────────────────────────────────
  {
    slug: "student-remittance",
    locale: "fa",
    title: "تسهیلات ارزی دانشجویی",
    metaTitle: "حواله دانشجویی از ایران به استرالیا | شهریه و بیمه OSHC | صرافی زرمان",
    metaDescription: "پرداخت شهریه دانشگاه‌های استرالیا، بیمه OSHC، هزینه ویزا و هزینه‌های زندگی دانشجویی با بهترین نرخ و بدون کارمزد از طریق زرمان.",
    h1: "تسهیلات ارزی برای دانشجویان مهاجر به استرالیا",
    description:
      "تمرکز خود را روی تحصیل بگذارید و دغدغه‌های مالی را به ما بسپارید. کلیه امور ارزی دانشجویان از جمله پرداخت شهریه، هزینه‌های ویزا، اقامت و بیمه با بهترین نرخ و بدون هیچ‌گونه کارمزد.",
    bodyHtml: `
<h2>این سرویس برای چه کسانی مناسب است؟</h2>
<p>دانشجویان ایرانی در استرالیا یا خانواده‌هایی که از ایران هزینه‌های تحصیلی فرزندشان را تأمین می‌کنند و به پرداخت منظم به ریال استرالیا نیاز دارند.</p>

<h2>چه پرداخت‌هایی پوشش داده می‌شود؟</h2>
<ul>
  <li><strong>شهریه دانشگاه</strong> — پرداخت مستقیم به هر مؤسسه آموزشی استرالیایی</li>
  <li><strong>بیمه OSHC</strong> — بیمه سلامت اجباری برای دارندگان ویزای دانشجویی</li>
  <li><strong>هزینه ویزای دانشجویی</strong> — پرداخت به وزارت کشور استرالیا</li>
  <li><strong>هزینه اقامت و زندگی</strong> — ودیعه اجاره، قبوض و هزینه‌های جاری</li>
  <li><strong>آزمون‌های زبان</strong> — IELTS، PTE، TOEFL</li>
</ul>

<h2>چرا زرمان برای پرداخت‌های دانشجویی؟</h2>
<p>پرداخت‌های دانشجویی اغلب مهلت‌های سختی دارند. تسویه سریع زرمان تضمین می‌کند که پرداخت شما به موقع انجام شود و رسید رسمی بلافاصله برای شما ارسال گردد.</p>

<h2>چگونه شروع کنم؟</h2>
<p><a href="/fa/register">ثبت‌نام رایگان</a> کنید، احراز هویت را تکمیل نمایید و اولین درخواست تراکنش خود را ثبت کنید.</p>
`,
  },
  {
    slug: "healthcare-professional-payments",
    locale: "fa",
    title: "پرداخت‌های کادر درمان",
    metaTitle: "پرداخت هزینه‌های رجیستری پزشکی در استرالیا | AMC AHPRA NCLEX | صرافی زرمان",
    metaDescription: "پرداخت هزینه‌های AMC، PESCI، ADC، NCLEX، OSCE، OET و AHPRA از ایران با سریع‌ترین نرخ و بدون کارمزد از طریق صرافی زرمان.",
    h1: "پرداخت هزینه‌های رجیستری و آزمون‌های پزشکی در استرالیا",
    description:
      "صفر تا صد پرداخت‌های مسیر رجیستری کادر درمان در استرالیا را به زرمان بسپارید. انجام سریع و بدون کارمزد هزینه‌های AMC، PESCI، ADC، NCLEX، OSCE، OET و AHPRA.",
    bodyHtml: `
<h2>این سرویس برای چه کسانی است؟</h2>
<p>پزشکان، دندان‌پزشکان، پرستاران، داروسازان و سایر متخصصان بهداشت ایرانی که در مسیر ثبت‌نام در سازمان‌های حرفه‌ای استرالیا هستند.</p>

<h2>هزینه‌های آزمون و ثبت‌نامی که پوشش می‌دهیم</h2>
<ul>
  <li><strong>AMC</strong> — هزینه آزمون MCQ و بالینی شورای پزشکی استرالیا</li>
  <li><strong>PESCI</strong> — ارزیابی متخصصین</li>
  <li><strong>ADC</strong> — آزمون دندان‌پزشکی استرالیا</li>
  <li><strong>NCLEX / OSCE</strong> — آزمون‌های رجیستری پرستاری</li>
  <li><strong>OET</strong> — آزمون زبان انگلیسی اختصاصی بهداشت</li>
  <li><strong>AHPRA</strong> — هزینه ثبت‌نام سالانه در سازمان بهداشت استرالیا</li>
</ul>

<h2>چرا زمان‌بندی مهم است؟</h2>
<p>بسیاری از ثبت‌نام‌های آزمون پزشکی مهلت‌های سختی دارند. تأخیر در پرداخت می‌تواند باعث شود ۶ تا ۱۲ ماه فرصت آزمون از دست برود. زرمان پرداخت‌های کادر درمان را در اولویت پردازش همان‌روزه قرار می‌دهد.</p>

<h2>شروع کنید</h2>
<p><a href="/fa/register">حساب کاربری بسازید</a> و اولین درخواست پرداخت را ثبت کنید.</p>
`,
  },
  {
    slug: "capital-and-asset-transfer",
    locale: "fa",
    title: "انتقال سرمایه و دارایی",
    metaTitle: "انتقال سرمایه از ایران به استرالیا | فروش ملک | صرافی زرمان",
    metaDescription: "انتقال امن مبالغ بزرگ، عواید فروش ملک و دارایی‌های خانوادگی بین ایران و استرالیا. صرافی ثبت‌شده AUSTRAC با انطباق کامل قانونی.",
    h1: "انتقال امن سرمایه و دارایی‌های خانوادگی بین ایران و استرالیا",
    description:
      "دغدغه جابه‌جایی مبالغ بالا را فراموش کنید. بستری امن و سریع برای انتقال سرمایه‌های شخصی، فروش ملک و دارایی‌های خانوادگی با حفظ ارزش سرمایه در مسیر ایران و استرالیا.",
    bodyHtml: `
<h2>چه زمانی به این سرویس نیاز دارید؟</h2>
<p>انتقال سرمایه‌های بزرگ در موقعیت‌های مختلف مطرح می‌شود: فروش ملک در ایران یا استرالیا، دریافت ارث خانوادگی، انتقال پس‌انداز هنگام مهاجرت، یا تجمیع دارایی‌های خانوادگی.</p>

<h2>نرخ ویژه برای مبالغ بالا</h2>
<p>برای انتقال‌های بالاتر از آستانه‌های معمول، زرمان یک مدیر حساب اختصاصی تعیین می‌کند که بر اساس حجم تراکنش، نرخ شخصی‌سازی‌شده ارائه می‌دهد. سیستم وفاداری ما به این معناست که مبالغ بزرگ‌تر نرخ بهتری دریافت می‌کنند.</p>

<h2>مستندات و انطباق قانونی</h2>
<p>تمام انتقال‌های سرمایه بزرگ طبق قوانین AUSTRAC نیاز به مستندات منشأ وجه دارند. تیم انطباق زرمان شما را در هر مرحله راهنمایی می‌کند.</p>

<h2>شروع انتقال سرمایه</h2>
<p><a href="/fa/register">ثبت‌نام</a> کنید و احراز هویت را تکمیل نمایید، سپس از طریق واتساپ با تیم ما تماس بگیرید تا نرخ شخصی‌سازی‌شده دریافت کنید.</p>
`,
  },
  {
    slug: "business-payment-infrastructure",
    locale: "fa",
    title: "زیرساخت پرداخت‌های تجاری",
    metaTitle: "پرداخت‌های تجاری بین ایران و استرالیا | سیستم آفست | صرافی زرمان",
    metaDescription: "تسهیل مبادلات تجاری و مدیریت نقدینگی فرامرزی بین ایران و استرالیا با سیستم آفست تسویه زرمان. سریع، مطمئن و با کمترین هزینه.",
    h1: "زیرساخت پرداخت‌های تجاری و سیستم آفست تسویه",
    description:
      "تسهیل مبادلات تجاری و مدیریت نقدینگی فرامرزی با تمرکز بر سرعت. سیستم آفست تسویه زرمان به کسب‌وکارها امکان می‌دهد تا پوزیشن‌های خود را در مسیر AUD/IRT خالص‌سازی کنند.",
    bodyHtml: `
<h2>سیستم آفست تسویه چیست؟</h2>
<p>به جای هدایت هر پرداخت از طریق کانال‌های بانکداری مکاتباتی سنتی، سیستم آفست زرمان جریان‌های رفت و برگشت را در مسیر AUD/IRT تطبیق می‌دهد. این امر هزینه‌های واسطه را حذف کرده و زمان تسویه را به شکل چشمگیری کاهش می‌دهد.</p>

<h2>موارد استفاده</h2>
<ul>
  <li><strong>پرداخت‌های واردات و صادرات</strong> — تسویه فاکتور بین شرکای تجاری ایرانی و استرالیایی</li>
  <li><strong>قراردادهای خدماتی</strong> — پرداخت به پیمانکاران یا تأمین‌کنندگان ایرانی از حساب‌های استرالیایی</li>
  <li><strong>حقوق و دستمزد</strong> — پرداخت حقوق کارمندان در هر دو کشور</li>
  <li><strong>مدیریت نقدینگی</strong> — مدیریت پوزیشن‌های خزانه در دو بازار</li>
</ul>

<h2>ورود مشتریان سازمانی</h2>
<p>مشتریان تجاری تحت ارزیابی دقیق‌تری طبق الزامات AUSTRAC قرار می‌گیرند. زرمان برای تمام حساب‌های سازمانی یک مدیر رابطه اختصاصی تعیین می‌کند. <a href="/fa/register">کسب‌وکار خود را ثبت</a> کنید یا برای بحث درباره نیازهای خاص با ما تماس بگیرید.</p>
`,
  },
];