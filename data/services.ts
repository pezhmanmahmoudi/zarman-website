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
    metaTitle: "Student Tuition & Payments: Iran to Australia",
    metaDescription: "Arrange Australian tuition, OSHC, visa and living-cost payments from Iran. Confirm payment availability, the quoted AUD rate, fees and required documents.",
    h1: "AUD Remittance for Students Migrating to Australia",
    description:
      "Explore payments for Australian tuition, visa charges, accommodation and OSHC insurance. Confirm availability, the quoted rate and any fees for your payment.",
    bodyHtml: `
<h2>Who Is This Service For?</h2>
<p>Iranian students studying in Australia, or families in Iran supporting students, who need to make regular AUD payments including tuition fees, OSHC health insurance, student visa charges, and accommodation deposits.</p>

<h2>What Payments Are Covered?</h2>
<ul>
  <li><strong>University tuition fees</strong> — confirm the institution and its accepted payment method</li>
  <li><strong>OSHC health insurance</strong> — check the cover requirements for your visa</li>
  <li><strong>Student visa application fees</strong> — paid to the Department of Home Affairs</li>
  <li><strong>Accommodation and living costs</strong> — rent bonds, utilities, general living expenses</li>
  <li><strong>English language test fees</strong> — IELTS, PTE, TOEFL</li>
</ul>

<h2>Why Use Zarman for Student Payments?</h2>
<p>Student payments often have strict deadlines set by universities. Share the due date and payment instructions with our team before arranging the transfer. We will confirm the expected processing time and the documents needed. Any loyalty discount depends on approved transaction volume and current pricing settings.</p>

<h2>How to Get Started</h2>
<p><a href="/en/register">Register a free account</a>, complete the requested identity verification, and submit your first transaction request. Our support team is available on WhatsApp for any questions.</p>
`,
  },
  {
    slug: "healthcare-professional-payments",
    locale: "en",
    title: "Healthcare Professional Payments",
    metaTitle: "Healthcare Exam & Registration Payments in Australia",
    metaDescription: "Enquire about payments from Iran for Australian healthcare exams and registration. Confirm the payee, currency, payment method, fees and processing time.",
    h1: "AUD Payments for Healthcare Professionals Registering in Australia",
    description:
      "Enquire about payments for healthcare exams, assessments and registration, including AMC, PESCI, OET and Ahpra. Payment currency and accepted methods depend on the organisation.",
    bodyHtml: `
<h2>Who Is This Service For?</h2>
<p>Iranian doctors, dentists, nurses, pharmacists and allied health professionals going through the Australian registration process who need to make AUD payments for exams, assessments and registration bodies.</p>

<h2>Covered Exam and Registration Fees</h2>
<ul>
  <li><strong>AMC (Australian Medical Council)</strong> — MCQ and clinical examination fees</li>
  <li><strong>PESCI (Pre-employment Structured Clinical Interview)</strong> — check requirements with the Medical Board of Australia</li>
  <li><strong>ADC (Australian Dental Council)</strong> — written and practical exam fees</li>
  <li><strong>NCLEX / OSCE</strong> — nursing registration examination fees</li>
  <li><strong>OET (Occupational English Test)</strong> — language proficiency test for healthcare</li>
  <li><strong>AHPRA registration fees</strong> — annual registration with the Australian Health Practitioner Regulation Agency</li>
</ul>

<h2>Why Timing Matters</h2>
<p>Many healthcare exam registrations have payment deadlines tied to exam booking windows. Share the official booking deadline, invoice and accepted payment methods with our team. Confirm availability and the expected settlement time before relying on a transfer for an exam booking.</p>

<h2>Get Started</h2>
<p><a href="/en/register">Create your account</a> and submit your first payment request. Use payee details and fee information supplied by the relevant examination or registration body, then confirm the payment requirements with our team.</p>
`,
  },
  {
    slug: "capital-and-asset-transfer",
    locale: "en",
    title: "Capital & Asset Transfer",
    metaTitle: "Capital Transfers Between Australia and Iran",
    metaDescription: "Enquire about transferring property sale proceeds, inheritance and personal capital between Australia and Iran. Discuss eligibility, documents and a personalised quote.",
    h1: "Secure Large Capital & Asset Transfers Between Australia and Iran",
    description:
      "Discuss a transfer of personal capital, property sale proceeds or family assets between Australia and Iran. Availability, documentation and settlement timing are assessed for your circumstances.",
    bodyHtml: `
<h2>When Do You Need This?</h2>
<p>Large cross-border transfers arise in several situations: selling property in Iran or Australia, repatriating family inheritance, transferring savings when relocating, or consolidating family assets across the two countries.</p>

<h2>How Zarman Handles Large Transfers</h2>
<p>Contact our team with the amount, purpose, source of funds and intended recipient. We can discuss the information needed to assess your request and provide a quote if the transfer can be supported.</p>

<h2>Compliance and Documentation</h2>
<p>Depending on the transaction, you may be asked for source-of-funds information, sale or inheritance documents and recipient details. The required checks and documents are assessed for each request.</p>

<h2>Start a Large Transfer</h2>
<p><a href="/en/register">Register</a> and complete KYC verification, then contact our team directly via WhatsApp to discuss your transfer requirements and receive a personalised quote.</p>
`,
  },
  {
    slug: "business-payment-infrastructure",
    locale: "en",
    title: "Business Payment Infrastructure",
    metaTitle: "Business Payments Between Australia and Iran",
    metaDescription: "Discuss commercial payment requirements between Australia and Iran with Zarman. Confirm supported transactions, business documents, costs and settlement arrangements.",
    h1: "Enterprise AUD/IRT Payment Infrastructure for Businesses",
    description:
      "Discuss business payments and cross-border settlement requirements with our team. Support depends on the parties, purpose, documentation and payment arrangements for the transaction.",
    bodyHtml: `
<h2>What Is Offset Settlement?</h2>
<p>Offset settlement refers to matching payment obligations in opposite directions. It does not remove the need to assess the parties, purpose and applicable restrictions. Contact our team to discuss which settlement arrangements, if any, can support your business payment.</p>

<h2>Use Cases</h2>
<ul>
  <li><strong>Import/export payments</strong> — settling invoices between Australian and Iranian trading partners</li>
  <li><strong>Service contracts</strong> — paying Iranian contractors or suppliers from Australian accounts</li>
  <li><strong>Payroll</strong> — salary payments for staff in either jurisdiction</li>
  <li><strong>Liquidity management</strong> — managing treasury positions across the two markets</li>
</ul>

<h2>Enterprise Onboarding</h2>
<p>Business onboarding may require company registration details, information about owners and controllers, invoices and the purpose of payments. Our team will explain the checks needed for your circumstances. <a href="/en/register">Register your business</a> or contact us to discuss your specific requirements.</p>
`,
  },

  // ──────────────────────────── PERSIAN ────────────────────────────────────
  {
    slug: "student-remittance",
    locale: "fa",
    title: "تسهیلات ارزی دانشجویی",
    metaTitle: "حواله دانشجویی از ایران به استرالیا | شهریه و بیمه OSHC | صرافی زرمان",
    metaDescription: "درخواست پرداخت شهریه دانشگاه استرالیا، بیمه OSHC، هزینه ویزا و زندگی دانشجویی از ایران؛ بررسی امکان پرداخت، نرخ دلار، کارمزد و مدارک با زرمان.",
    h1: "تسهیلات ارزی برای دانشجویان مهاجر به استرالیا",
    description:
      "برای پرداخت شهریه، هزینه ویزا، اقامت و بیمه OSHC در استرالیا درخواست دهید. امکان انجام پرداخت، نرخ پیشنهادی و کارمزد احتمالی را با تیم زرمان تأیید کنید.",
    bodyHtml: `
<h2>این سرویس برای چه کسانی مناسب است؟</h2>
<p>دانشجویان ایرانی در استرالیا یا خانواده‌هایی که از ایران هزینه‌های تحصیلی فرزندشان را تأمین می‌کنند و به پرداخت منظم به دلار استرالیا نیاز دارند.</p>

<h2>چه پرداخت‌هایی پوشش داده می‌شود؟</h2>
<ul>
  <li><strong>شهریه دانشگاه</strong> — بررسی مؤسسه آموزشی و روش پرداخت مورد پذیرش آن</li>
  <li><strong>بیمه OSHC</strong> — بررسی پوشش بیمه موردنیاز برای ویزای شما</li>
  <li><strong>هزینه ویزای دانشجویی</strong> — پرداخت به وزارت کشور استرالیا</li>
  <li><strong>هزینه اقامت و زندگی</strong> — ودیعه اجاره، قبوض و هزینه‌های جاری</li>
  <li><strong>آزمون‌های زبان</strong> — IELTS، PTE، TOEFL</li>
</ul>

<h2>چرا زرمان برای پرداخت‌های دانشجویی؟</h2>
<p>پرداخت‌های دانشجویی اغلب مهلت‌های سختی دارند. پیش از حواله، مهلت و اطلاعات پرداخت را به تیم ما ارائه کنید تا زمان مورد انتظار پردازش و مدارک موردنیاز مشخص شود.</p>

<h2>چگونه شروع کنم؟</h2>
<p><a href="/fa/register">ثبت‌نام رایگان</a> کنید، احراز هویت را تکمیل نمایید و اولین درخواست تراکنش خود را ثبت کنید.</p>
`,
  },
  {
    slug: "healthcare-professional-payments",
    locale: "fa",
    title: "پرداخت‌های کادر درمان",
    metaTitle: "پرداخت هزینه آزمون و رجیستری پزشکی در استرالیا | صرافی زرمان",
    metaDescription: "درخواست پرداخت هزینه آزمون و رجیستری کادر درمان در استرالیا از ایران؛ بررسی گیرنده، واحد ارز، روش پرداخت، کارمزد و زمان تسویه با زرمان.",
    h1: "پرداخت هزینه‌های رجیستری و آزمون‌های پزشکی در استرالیا",
    description:
      "برای پرداخت هزینه آزمون‌ها و رجیستری کادر درمان از جمله AMC، PESCI، OET و Ahpra درخواست دهید. واحد ارز و روش پرداخت قابل قبول به سازمان مربوطه بستگی دارد.",
    bodyHtml: `
<h2>این سرویس برای چه کسانی است؟</h2>
<p>پزشکان، دندان‌پزشکان، پرستاران، داروسازان و سایر متخصصان بهداشت ایرانی که در مسیر ثبت‌نام در سازمان‌های حرفه‌ای استرالیا هستند.</p>

<h2>هزینه‌های آزمون و ثبت‌نامی که پوشش می‌دهیم</h2>
<ul>
  <li><strong>AMC</strong> — هزینه آزمون MCQ و بالینی شورای پزشکی استرالیا</li>
  <li><strong>PESCI</strong> — مصاحبه بالینی ساختاریافته پیش از استخدام</li>
  <li><strong>ADC</strong> — آزمون دندان‌پزشکی استرالیا</li>
  <li><strong>NCLEX / OSCE</strong> — آزمون‌های رجیستری پرستاری</li>
  <li><strong>OET</strong> — آزمون زبان انگلیسی اختصاصی بهداشت</li>
  <li><strong>AHPRA</strong> — هزینه ثبت‌نام در آژانس تنظیم مقررات متخصصان سلامت استرالیا</li>
</ul>

<h2>چرا زمان‌بندی مهم است؟</h2>
<p>بسیاری از ثبت‌نام‌های آزمون پزشکی مهلت‌های سختی دارند. مهلت رسمی ثبت‌نام، فاکتور و روش‌های پرداخت را با تیم ما در میان بگذارید. پیش از اتکا به حواله برای رزرو آزمون، امکان پرداخت و زمان مورد انتظار تسویه را تأیید کنید.</p>

<h2>شروع کنید</h2>
<p><a href="/fa/register">حساب کاربری بسازید</a> و اولین درخواست پرداخت را ثبت کنید.</p>
`,
  },
  {
    slug: "capital-and-asset-transfer",
    locale: "fa",
    title: "انتقال سرمایه و دارایی",
    metaTitle: "انتقال سرمایه از ایران به استرالیا | فروش ملک | صرافی زرمان",
    metaDescription: "درخواست انتقال مبالغ بزرگ، عواید فروش ملک، ارث و سرمایه شخصی بین ایران و استرالیا؛ بررسی امکان حواله، مدارک و نرخ شخصی‌سازی‌شده.",
    h1: "انتقال امن سرمایه و دارایی‌های خانوادگی بین ایران و استرالیا",
    description:
      "برای انتقال سرمایه شخصی، عواید فروش ملک یا دارایی خانوادگی بین ایران و استرالیا با ما گفت‌وگو کنید. امکان حواله، مدارک و زمان تسویه با توجه به شرایط شما بررسی می‌شود.",
    bodyHtml: `
<h2>چه زمانی به این سرویس نیاز دارید؟</h2>
<p>انتقال سرمایه‌های بزرگ در موقعیت‌های مختلف مطرح می‌شود: فروش ملک در ایران یا استرالیا، دریافت ارث خانوادگی، انتقال پس‌انداز هنگام مهاجرت، یا تجمیع دارایی‌های خانوادگی.</p>

<h2>نرخ ویژه برای مبالغ بالا</h2>
<p>مبلغ، هدف حواله، منشأ وجه و گیرنده را با تیم ما در میان بگذارید. مدارک موردنیاز برای ارزیابی درخواست مشخص می‌شود و در صورت امکان انجام حواله، پیشنهاد نرخ ارائه خواهد شد.</p>

<h2>مستندات و انطباق قانونی</h2>
<p>بسته به تراکنش، ممکن است اطلاعات منشأ وجه، مدارک فروش یا ارث و مشخصات گیرنده درخواست شود. بررسی‌ها و مدارک موردنیاز برای هر درخواست تعیین می‌شود.</p>

<h2>شروع انتقال سرمایه</h2>
<p><a href="/fa/register">ثبت‌نام</a> کنید و احراز هویت را تکمیل نمایید، سپس از طریق واتساپ با تیم ما تماس بگیرید تا نرخ شخصی‌سازی‌شده دریافت کنید.</p>
`,
  },
  {
    slug: "business-payment-infrastructure",
    locale: "fa",
    title: "زیرساخت پرداخت‌های تجاری",
    metaTitle: "پرداخت‌های تجاری بین ایران و استرالیا | سیستم آفست | صرافی زرمان",
    metaDescription: "بررسی پرداخت‌های تجاری بین ایران و استرالیا با زرمان؛ گفت‌وگو درباره امکان انجام تراکنش، مدارک کسب‌وکار، هزینه‌ها و شرایط تسویه.",
    h1: "زیرساخت پرداخت‌های تجاری و سیستم آفست تسویه",
    description:
      "درباره پرداخت‌های تجاری و شرایط تسویه بین ایران و استرالیا با تیم ما گفت‌وگو کنید. پشتیبانی از پرداخت به طرف‌ها، هدف، مدارک و شرایط تراکنش بستگی دارد.",
    bodyHtml: `
<h2>سیستم آفست تسویه چیست؟</h2>
<p>آفست به تطبیق تعهدات پرداخت در جهت‌های مخالف گفته می‌شود. این روش نیاز به بررسی طرف‌ها، هدف و محدودیت‌های قابل‌اعمال را برطرف نمی‌کند. برای بررسی روش تسویه قابل پشتیبانی برای پرداخت کسب‌وکارتان با تیم ما تماس بگیرید.</p>

<h2>موارد استفاده</h2>
<ul>
  <li><strong>پرداخت‌های واردات و صادرات</strong> — تسویه فاکتور بین شرکای تجاری ایرانی و استرالیایی</li>
  <li><strong>قراردادهای خدماتی</strong> — پرداخت به پیمانکاران یا تأمین‌کنندگان ایرانی از حساب‌های استرالیایی</li>
  <li><strong>حقوق و دستمزد</strong> — پرداخت حقوق کارمندان در هر دو کشور</li>
  <li><strong>مدیریت نقدینگی</strong> — مدیریت پوزیشن‌های خزانه در دو بازار</li>
</ul>

<h2>ورود مشتریان سازمانی</h2>
<p>برای پذیرش مشتری تجاری ممکن است اطلاعات ثبت شرکت، مالکان و کنترل‌کنندگان، فاکتورها و هدف پرداخت‌ها درخواست شود. تیم ما بررسی‌های لازم برای شرایط شما را توضیح می‌دهد. <a href="/fa/register">کسب‌وکار خود را ثبت</a> کنید یا برای بحث درباره نیازهای خاص با ما تماس بگیرید.</p>
`,
  },
];
