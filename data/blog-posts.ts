export interface BlogPost {
  slug: string;
  translationKey: string;
  locale: "en" | "fa";
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string; // ISO date string
  updatedAt?: string; // Actual editorial update, never generated at build time
  sources: { title: string; url: string }[];
  category: string;
  categoryLabel: string;
  readingTime: number; // minutes
  content: string; // trusted HTML — never from user input
}

export const blogPosts: BlogPost[] = [
  // ─────────────────────────────── ENGLISH ────────────────────────────────
  {
    slug: "aud-to-irt-exchange-rate-guide",
    translationKey: "aud-toman-rate-guide",
    locale: "en",
    title: "AUD to Toman: Compare Transfer Quotes",
    description:
      "Understand Australian dollar to toman rates, the difference between reference rates and transfer quotes, and how to compare the total amount your recipient receives.",
    keywords: [
      "AUD to IRT exchange rate",
      "AUD to toman",
      "dollar to toman Australia",
      "compare remittance quotes",
      "Australia Iran transfer fees",
    ],
    publishedAt: "2026-04-15",
    updatedAt: "2026-09-08",
    sources: [
      { title: "RBA: Drivers of the Australian dollar exchange rate", url: "https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html" },
      { title: "AUSTRAC: Remittance Sector Register", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "rates",
    categoryLabel: "Exchange Rates",
    readingTime: 3,
    content: `
<p><strong>An AUD to toman quote tells you how many toman you receive for one Australian dollar.</strong> To compare transfers, check the same AUD amount, the quoted rate, any separate fees and the final amount the recipient receives. A reference rate alone does not tell you the total cost.</p>

<h2>What Do AUD, IRT and Toman Mean?</h2>
<p>AUD is the Australian dollar. Zarman uses IRT as a label for amounts in Iranian toman. Currency tools may instead display Iranian rial (IRR), so confirm the unit before comparing figures or entering bank details. A rial amount and a toman amount must not be treated as interchangeable.</p>

<h2>How Is an AUD to Toman Quote Set?</h2>
<p>A cross-rate can be estimated by multiplying an AUD/USD rate by a USD/toman rate. That estimate is only meaningful when both inputs use compatible market sources and timestamps. A remittance quote can also reflect the provider's pricing, available liquidity, transfer direction and transaction costs.</p>
<p>Rates displayed on a currency information site may use a different market or currency unit from the amount available for your transfer. Always compare the actual amount payable to your recipient.</p>

<h2>Why Does the Australian Dollar Rate Change?</h2>
<p>The <a href="https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html">Reserve Bank of Australia explains</a> that interest rate differences, commodity prices and expectations can influence the Australian dollar. These factors interact; an interest rate announcement does not guarantee that the dollar will rise or fall. The toman side of a quote and the provider's own pricing can change too.</p>

<h2>How Can You Compare Two Transfer Quotes?</h2>
<ol>
  <li>Use the same transfer direction and the same total AUD budget.</li>
  <li>Ask whether the quote is in toman or rial and how long it remains valid.</li>
  <li>Check any separate fees, deductions and the exchange rate offered.</li>
  <li>Compare the final amount your recipient receives and the expected settlement time.</li>
</ol>
<p>For a simple illustration, AUD 1,000 converted at a fictional rate of 100,000 toman per AUD produces 100,000,000 toman before any separate charges. This example is not a current quote. If fees reduce the amount converted, use that reduced amount in the calculation.</p>

<h2>How Does Zarman's Personalised Pricing Work?</h2>
<p>Zarman's pricing can include a loyalty discount based on approved transaction volume and the current pricing settings. Eligibility, discount limits and any applicable transaction fee are reflected in your quote. Do not assume that every transfer is fee-free or that a previous rate still applies.</p>
<p><a href="/en/register">Create an account</a> to request your personalised rate and review the details before confirming. You can also check the available rate information on the <a href="/en">homepage</a>.</p>

<h2>What Else Should You Check Before Sending?</h2>
<p>Check the provider's current status in the <a href="https://online.apps.austrac.gov.au/rsr/">AUSTRAC Remittance Sector Register</a>, independently confirm payment details and ask about required documents. Registration is not a guarantee of a particular rate or transfer outcome. Our <a href="/en/blog/send-money-australia-to-iran">Australia to Iran transfer checklist</a> covers the next steps.</p>
    `.trim(),
  },

  {
    slug: "send-money-australia-to-iran",
    translationKey: "australia-iran-transfer-guide",
    locale: "en",
    title: "How to Send Money from Australia to Iran",
    description:
      "Step-by-step guide to transferring money from Australia to Iran. Learn AUSTRAC requirements, KYC, how to choose a registered remittance provider, and what to watch out for.",
    keywords: [
      "send money Australia to Iran",
      "transfer money Australia Iran",
      "Australia Iran remittance",
      "AUSTRAC remittance Australia",
      "how to transfer AUD to Iran",
    ],
    publishedAt: "2026-04-22",
    updatedAt: "2026-09-08",
    sources: [
      { title: "AUSTRAC: Remittance Sector Register", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "AUSTRAC: Customer due diligence", url: "https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence" },
      { title: "DFAT: Iran sanctions framework", url: "https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework" },
    ],
    category: "guides",
    categoryLabel: "How-To Guides",
    readingTime: 3,
    content: `
<p><strong>Before sending money from Australia to Iran, confirm that the provider can support your specific transfer.</strong> Check the provider's registration, required identity documents, recipient details, final quoted amount and expected settlement time before paying.</p>

<h2>1. Check the Provider and Transfer Availability</h2>
<p>Search the provider's business name or ABN in the <a href="https://online.apps.austrac.gov.au/rsr/">AUSTRAC Remittance Sector Register</a>. Zarman's company details are listed on our <a href="/en/about">About page</a> so you can compare them with the official register.</p>
<p>Registration alone does not determine whether a particular transaction can proceed. Australia's <a href="https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework">Iran sanctions framework</a> includes restrictions that may affect financial services and payments. Ask the provider to confirm whether the purpose, parties and payment route can be supported before sending funds.</p>

<h2>2. Complete Identity Verification</h2>
<p>The provider will explain which identity and supporting documents are required for your circumstances. These may include identity documents, address information, recipient details and information about the purpose or source of funds. Send documents only through the provider's confirmed verification process.</p>
<p>AUSTRAC's <a href="https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence">customer due diligence guidance</a> covers initial and ongoing checks. You may be asked to update information or provide additional documents after your first transfer.</p>

<h2>3. Review the Full Quote</h2>
<p>Confirm the amount you pay in AUD, the exchange rate, any fees and the amount the recipient receives. Check whether the receiving amount is expressed in toman or rial. Ask when the quote expires and what happens if payment arrives after that time.</p>
<p>Our <a href="/en/blog/aud-to-irt-exchange-rate-guide">AUD to toman rate guide</a> explains how to compare quotes. At Zarman, review the request details and current terms in your account before confirming.</p>

<h2>4. Verify the Payment Instructions</h2>
<p>Use payment details confirmed through the provider's official channel. Check the account name, amount and payment reference. If instructions change or arrive unexpectedly, contact the provider through a previously verified contact method before paying.</p>
<p>Keep a copy of your quote, payment confirmation and correspondence. Do not send additional funds solely because an unfamiliar caller or message asks you to do so.</p>

<h2>5. Track Settlement and Keep Your Receipt</h2>
<p>Settlement depends on cleared funds, document checks, banking arrangements and recipient details. Ask for an estimate for your specific transfer and confirm how delays or unsuccessful payments will be handled. Avoid assuming same-day delivery.</p>
<p>Check the final transaction receipt and confirm receipt with the recipient. Contact the provider promptly if the amount or details differ from your agreed quote.</p>

<h2>Arrange a Transfer with Zarman</h2>
<p><a href="/en/register">Create your account</a> to complete verification and request a personalised quote. Our <a href="/en/services">services pages</a> explain student, healthcare, personal capital and business payment enquiries.</p>
    `.trim(),
  },

  // ─────────────────────────────── PERSIAN ────────────────────────────────
  {
    slug: "rahnamaye-nerkh-aud-irt",
    translationKey: "aud-toman-rate-guide",
    locale: "fa",
    title: "نرخ دلار استرالیا به تومان؛ راهنمای مقایسه هزینه حواله",
    description:
      "نرخ دلار استرالیا به تومان چگونه تعیین می‌شود؟ با تفاوت نرخ مرجع و نرخ حواله، هزینه‌ها و روش مقایسه مبلغ نهایی دریافتی گیرنده آشنا شوید.",
    keywords: [
      "نرخ دلار استرالیا به تومان",
      "مقایسه نرخ دلار استرالیا",
      "نرخ AUD به IRT",
      "نرخ ارز استرالیا",
      "هزینه حواله استرالیا به ایران",
    ],
    publishedAt: "2026-04-15",
    updatedAt: "2026-09-08",
    sources: [
      { title: "بانک مرکزی استرالیا: عوامل مؤثر بر نرخ دلار استرالیا (انگلیسی)", url: "https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html" },
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "rates",
    categoryLabel: "نرخ ارز",
    readingTime: 3,
    content: `
<p><strong>نرخ دلار استرالیا به تومان نشان می‌دهد به ازای هر دلار استرالیا چند تومان دریافت می‌کنید.</strong> برای مقایسه حواله‌ها، مبلغ یکسان دلار، نرخ پیشنهادی، هزینه‌های جداگانه و مبلغ نهایی دریافتی گیرنده را بررسی کنید. نرخ مرجع به‌تنهایی هزینه کامل انتقال را نشان نمی‌دهد.</p>

<h2>AUD، IRT و تومان چه تفاوتی دارند؟</h2>
<p>AUD کد دلار استرالیاست. در زرمان، IRT برای نمایش مبلغ به تومان استفاده می‌شود. برخی ابزارهای ارزی مبلغ را به ریال ایران یا IRR نشان می‌دهند؛ بنابراین پیش از مقایسه نرخ یا وارد کردن اطلاعات پرداخت، واحد مبلغ را تأیید کنید. مبلغ ریالی و تومانی را نباید یکسان در نظر گرفت.</p>

<h2>نرخ دلار استرالیا به تومان چگونه محاسبه می‌شود؟</h2>
<p>برای برآورد نرخ متقاطع می‌توان نرخ AUD/USD را در نرخ دلار آمریکا به تومان ضرب کرد. این برآورد زمانی قابل مقایسه است که منبع بازار و زمان ثبت هر دو نرخ سازگار باشد. نرخ پیشنهادی حواله ممکن است به قیمت‌گذاری ارائه‌دهنده، نقدینگی، جهت انتقال و هزینه‌های تراکنش نیز بستگی داشته باشد.</p>
<p>نرخ سایت‌های اطلاع‌رسانی ارز ممکن است به بازار یا واحد پول متفاوتی مربوط باشد. ملاک مقایسه، مبلغ واقعی قابل پرداخت به گیرنده در حواله شماست.</p>

<h2>چرا نرخ دلار استرالیا تغییر می‌کند؟</h2>
<p>طبق توضیح <a href="https://www.rba.gov.au/education/resources/explainers/drivers-of-the-aud-exchange-rate.html">بانک مرکزی استرالیا</a>، اختلاف نرخ بهره، قیمت کالاهای صادراتی و انتظارات بازار می‌توانند بر دلار استرالیا اثر بگذارند. این عوامل با یکدیگر تعامل دارند و اعلام نرخ بهره به‌تنهایی افزایش یا کاهش دلار را تضمین نمی‌کند. ارزش تومان و قیمت‌گذاری ارائه‌دهنده هم ممکن است تغییر کند.</p>

<h2>چگونه دو پیشنهاد حواله را مقایسه کنیم؟</h2>
<ol>
  <li>جهت حواله و بودجه کل به دلار استرالیا را یکسان در نظر بگیرید.</li>
  <li>تومانی یا ریالی بودن مبلغ و مدت اعتبار نرخ را بپرسید.</li>
  <li>کارمزدها، کسورات و نرخ تبدیل پیشنهادی را بررسی کنید.</li>
  <li>مبلغ نهایی دریافتی گیرنده و زمان مورد انتظار تسویه را مقایسه کنید.</li>
</ol>
<p>برای نمونه، تبدیل ۱۰۰۰ دلار با نرخ فرضی ۱۰۰٬۰۰۰ تومان برای هر دلار، پیش از هزینه‌های جداگانه برابر با ۱۰۰٬۰۰۰٬۰۰۰ تومان است. این مثال نرخ امروز نیست. اگر کارمزد از مبلغ قابل تبدیل کم می‌شود، محاسبه را با مبلغ پس از کسر کارمزد انجام دهید.</p>

<h2>نرخ شخصی‌سازی‌شده زرمان چگونه تعیین می‌شود؟</h2>
<p>قیمت‌گذاری زرمان می‌تواند شامل تخفیف وفاداری بر اساس حجم تراکنش‌های تأییدشده و تنظیمات جاری قیمت‌گذاری باشد. شرایط دریافت تخفیف، سقف آن و کارمزد احتمالی در پیشنهاد حواله شما مشخص می‌شود. بدون کارمزد بودن همه حواله‌ها یا اعتبار داشتن نرخ قبلی را فرض نکنید.</p>
<p>برای درخواست نرخ شخصی و بررسی جزئیات پیش از تأیید، <a href="/fa/register">حساب کاربری ایجاد کنید</a>. اطلاعات نرخ در دسترس را می‌توانید در <a href="/fa">صفحه اصلی</a> هم ببینید.</p>

<h2>پیش از ارسال وجه چه موارد دیگری را بررسی کنیم؟</h2>
<p>وضعیت ثبت ارائه‌دهنده را در <a href="https://online.apps.austrac.gov.au/rsr/">سامانه رسمی AUSTRAC</a> بررسی کنید، اطلاعات پرداخت را مستقلاً تأیید کنید و درباره مدارک موردنیاز بپرسید. ثبت AUSTRAC تضمین‌کننده نرخ مشخص یا نتیجه حواله نیست. مراحل بعدی را در <a href="/fa/blog/havaleh-az-australia-be-iran">راهنمای حواله از استرالیا به ایران</a> بخوانید.</p>
    `.trim(),
  },

  {
    slug: "havaleh-az-australia-be-iran",
    translationKey: "australia-iran-transfer-guide",
    locale: "fa",
    title: "حواله از استرالیا به ایران؛ مراحل و نکات پیش از انتقال",
    description:
      "مراحل حواله از استرالیا به ایران: بررسی ثبت ارائه‌دهنده، احراز هویت، نرخ و کارمزد، اطلاعات پرداخت و پیگیری دریافت وجه توسط گیرنده.",
    keywords: [
      "حواله از استرالیا به ایران",
      "انتقال پول از استرالیا به ایران",
      "ارسال پول به ایران از استرالیا",
      "صرافی مجاز استرالیا",
      "AUSTRAC صرافی",
    ],
    publishedAt: "2026-04-22",
    updatedAt: "2026-09-08",
    sources: [
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "AUSTRAC: شناسایی و ارزیابی مشتری (انگلیسی)", url: "https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence" },
      { title: "وزارت امور خارجه استرالیا: چارچوب تحریم‌های ایران (انگلیسی)", url: "https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework" },
    ],
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 3,
    content: `
<p><strong>پیش از حواله از استرالیا به ایران، امکان انجام همان تراکنش را با ارائه‌دهنده تأیید کنید.</strong> وضعیت ثبت ارائه‌دهنده، مدارک احراز هویت، مشخصات گیرنده، مبلغ نهایی و زمان مورد انتظار تسویه را پیش از واریز وجه بررسی کنید.</p>

<h2>۱. بررسی ارائه‌دهنده و امکان انجام حواله</h2>
<p>نام شرکت یا شماره ABN را در <a href="https://online.apps.austrac.gov.au/rsr/">سامانه ثبت ارائه‌دهندگان حواله AUSTRAC</a> جست‌وجو کنید. اطلاعات شرکت زرمان در <a href="/fa/about">صفحه درباره ما</a> درج شده تا بتوانید آن را با سامانه رسمی مقایسه کنید.</p>
<p>ثبت شرکت به‌تنهایی مشخص نمی‌کند که هر تراکنش قابل انجام است. <a href="https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework">چارچوب تحریم‌های ایران در استرالیا</a> شامل محدودیت‌هایی است که ممکن است بر خدمات مالی و پرداخت‌ها اثر بگذارد. پیش از واریز وجه، از ارائه‌دهنده بخواهید امکان پشتیبانی از هدف حواله، طرف‌های تراکنش و مسیر پرداخت را بررسی کند.</p>

<h2>۲. تکمیل احراز هویت</h2>
<p>ارائه‌دهنده مدارک موردنیاز را با توجه به شرایط شما مشخص می‌کند. ممکن است مدارک هویتی، اطلاعات آدرس، مشخصات گیرنده و توضیح هدف حواله یا منشأ وجه درخواست شود. مدارک را فقط از مسیر تأییدشده احراز هویت ارائه‌دهنده ارسال کنید.</p>
<p><a href="https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence">راهنمای شناسایی و ارزیابی مشتری AUSTRAC</a> بررسی‌های اولیه و مستمر را پوشش می‌دهد. پس از اولین حواله نیز ممکن است به به‌روزرسانی اطلاعات یا ارائه مدارک بیشتر نیاز باشد.</p>

<h2>۳. بررسی کامل نرخ و هزینه حواله</h2>
<p>مبلغ پرداختی به دلار استرالیا، نرخ تبدیل، کارمزدها و مبلغ دریافتی گیرنده را تأیید کنید. مشخص کنید مبلغ مقصد به تومان است یا ریال. مدت اعتبار نرخ و شرایط تأخیر در رسیدن وجه را از ارائه‌دهنده بپرسید.</p>
<p><a href="/fa/blog/rahnamaye-nerkh-aud-irt">راهنمای نرخ دلار استرالیا به تومان</a> روش مقایسه پیشنهادها را توضیح می‌دهد. در زرمان، پیش از تأیید، جزئیات درخواست و شرایط جاری را در حساب کاربری خود بررسی کنید.</p>

<h2>۴. تأیید اطلاعات واریز</h2>
<p>از اطلاعات پرداختی استفاده کنید که از مسیر رسمی ارائه‌دهنده تأیید شده است. نام حساب، مبلغ و شناسه پرداخت را بررسی کنید. اگر اطلاعات تغییر کرده یا پیام غیرمنتظره‌ای دریافت کرده‌اید، پیش از پرداخت از راه ارتباطی معتبر و از قبل شناخته‌شده با ارائه‌دهنده تماس بگیرید.</p>
<p>نسخه‌ای از پیشنهاد نرخ، تأیید پرداخت و مکاتبات را نگه دارید. صرفاً به درخواست تماس‌گیرنده یا پیام ناشناس وجه بیشتری ارسال نکنید.</p>

<h2>۵. پیگیری تسویه و نگهداری رسید</h2>
<p>زمان تسویه به دریافت قطعی وجه، بررسی مدارک، شرایط بانکی و مشخصات گیرنده بستگی دارد. زمان تخمینی همان حواله و نحوه رسیدگی به تأخیر یا پرداخت ناموفق را بپرسید. تسویه همان‌روزه را قطعی فرض نکنید.</p>
<p>رسید نهایی را بررسی و دریافت وجه را با گیرنده تأیید کنید. در صورت تفاوت مبلغ یا اطلاعات با پیشنهاد توافق‌شده، سریعاً با ارائه‌دهنده تماس بگیرید.</p>

<h2>ثبت درخواست حواله در زرمان</h2>
<p>برای تکمیل احراز هویت و درخواست نرخ شخصی‌سازی‌شده، <a href="/fa/register">حساب کاربری ایجاد کنید</a>. در <a href="/fa/services">صفحه خدمات</a> درباره پرداخت‌های دانشجویی، کادر درمان، انتقال سرمایه و پرداخت‌های تجاری بیشتر بخوانید.</p>
    `.trim(),
  },
];

/** Only link translations that actually exist; Persian and English slugs differ. */
export function getBlogAlternatePaths(post: BlogPost): Partial<Record<BlogPost["locale"], string>> {
  return Object.fromEntries(
    blogPosts.filter((candidate) => candidate.translationKey === post.translationKey)
      .map((candidate) => [candidate.locale, `/blog/${candidate.slug}`]),
  );
}
