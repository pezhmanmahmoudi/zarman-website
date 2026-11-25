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
    title: "How to Send Money to Iran from Australia",
    description:
      "How to send, transfer or wire money to Iran from Australia: choosing an AUSTRAC-registered provider, identity checks, fees, timing and how to track your transfer.",
    keywords: [
      "send money to Iran",
      "transfer money to Iran",
      "wire money to Iran",
      "money transfer Iran",
      "send money Australia to Iran",
    ],
    publishedAt: "2026-04-22",
    updatedAt: "2026-11-25",
    sources: [
      { title: "AUSTRAC: Remittance Sector Register", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "AUSTRAC: Customer due diligence", url: "https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence" },
      { title: "DFAT: Iran sanctions framework", url: "https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework" },
    ],
    category: "guides",
    categoryLabel: "How-To Guides",
    readingTime: 3,
    content: `
<p><strong>To send money to Iran from Australia, you pay Australian dollars to an AUSTRAC-registered remittance provider, which pays the toman equivalent into the recipient's Iranian bank account.</strong> Before paying, check the provider's registration, required identity documents, recipient details, final quoted amount and expected settlement time.</p>

<h2>Can You Wire Money to Iran from an Australian Bank?</h2>
<p>Usually not. Most Australian banks do not send international wire transfers to Iranian banks, so people transfer money to Iran through a registered remittance provider instead. If you are unsure whether a transfer is allowed, read <a href="/en/blog/can-you-send-money-to-iran">can you send money to Iran from Australia</a>.</p>

<h2>1. Check the Provider and Transfer Availability</h2>
<p>Search the provider's business name or ABN in the <a href="https://online.apps.austrac.gov.au/rsr/">AUSTRAC Remittance Sector Register</a>. Zarman's company details are listed on our <a href="/en/about">About page</a> so you can compare them with the official register.</p>
<p>Registration alone does not determine whether a particular transaction can proceed. Australia's <a href="https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework">Iran sanctions framework</a> includes restrictions that may affect financial services and payments. Ask the provider to confirm whether the purpose, parties and payment route can be supported before sending funds.</p>

<h2>2. Complete Identity Verification</h2>
<p>The provider will explain which identity and supporting documents are required for your circumstances. These may include identity documents, address information, recipient details and information about the purpose or source of funds. Send documents only through the provider's confirmed verification process.</p>
<p>AUSTRAC's <a href="https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence">customer due diligence guidance</a> covers initial and ongoing checks. You may be asked to update information or provide additional documents after your first transfer.</p>

<h2>3. Review the Full Quote</h2>
<p>Confirm the amount you pay in AUD, the exchange rate, any fees and the amount the recipient receives. Check whether the receiving amount is expressed in toman or rial. Ask when the quote expires and what happens if payment arrives after that time.</p>
<p>Our <a href="/en/blog/aud-to-irt-exchange-rate-guide">AUD to toman rate guide</a> explains how to compare quotes. At Zarman, transfers of AUD {{feeThreshold}} or more have no transfer fee, and smaller transfers have a flat AUD {{appliedFee}} fee. Check today's <a href="/en/rates">AUD to toman rate</a>, and review the request details in your account before confirming.</p>

<h2>4. Verify the Payment Instructions</h2>
<p>Use payment details confirmed through the provider's official channel. Check the account name, amount and payment reference. If instructions change or arrive unexpectedly, contact the provider through a previously verified contact method before paying.</p>
<p>Keep a copy of your quote, payment confirmation and correspondence. Do not send additional funds solely because an unfamiliar caller or message asks you to do so.</p>

<h2>5. Track Settlement and Keep Your Receipt</h2>
<p>At Zarman, about 70% of transfers settle in under 5 hours and 95% in under 24 hours. Timing for any single transfer depends on cleared funds, document checks, Iranian banking hours (banks in Iran are closed on Fridays) and correct recipient details, so it is not guaranteed.</p>
<p>Check the final transaction receipt and confirm receipt with the recipient. Contact the provider promptly if the amount or details differ from your agreed quote.</p>

<h2>Arrange a Transfer with Zarman</h2>
<p>Need to move money the other way? See <a href="/en/blog/send-money-iran-to-australia">sending money from Iran to Australia</a>.</p>
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
    title: "انتقال پول از استرالیا به ایران؛ مراحل و زمان حواله",
    description:
      "انتقال پول و دلار از استرالیا به ایران در ۵ مرحله: بررسی صرافی ثبت‌شده در AUSTRAC، احراز هویت، نرخ و کارمزد، اطلاعات واریز، زمان تسویه و پیگیری حواله.",
    keywords: [
      "انتقال پول از استرالیا به ایران",
      "حواله از استرالیا به ایران",
      "انتقال دلار از استرالیا به ایران",
      "حواله دلار استرالیا به ایران",
      "ارسال پول به ایران از استرالیا",
    ],
    publishedAt: "2026-04-22",
    updatedAt: "2026-11-25",
    sources: [
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "AUSTRAC: شناسایی و ارزیابی مشتری (انگلیسی)", url: "https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence" },
      { title: "وزارت امور خارجه استرالیا: چارچوب تحریم‌های ایران (انگلیسی)", url: "https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework" },
    ],
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 3,
    content: `
<p><strong>برای انتقال پول از استرالیا به ایران، دلار استرالیا را به حساب یک صرافی ثبت‌شده در AUSTRAC واریز می‌کنید و معادل تومان آن به حساب گیرنده در ایران واریز می‌شود.</strong> پیش از واریز، وضعیت ثبت صرافی، مدارک احراز هویت، مشخصات گیرنده، مبلغ نهایی و زمان مورد انتظار تسویه را بررسی کنید.</p>
<p>بیشتر بانک‌های استرالیا حوالهٔ مستقیم به بانک‌های ایران انجام نمی‌دهند؛ برای همین انتقال دلار از استرالیا به ایران معمولاً از طریق صرافی انجام می‌شود.</p>

<h2>۱. بررسی ارائه‌دهنده و امکان انجام حواله</h2>
<p>نام شرکت یا شماره ABN را در <a href="https://online.apps.austrac.gov.au/rsr/">سامانه ثبت ارائه‌دهندگان حواله AUSTRAC</a> جست‌وجو کنید. اطلاعات شرکت زرمان در <a href="/fa/about">صفحه درباره ما</a> درج شده تا بتوانید آن را با سامانه رسمی مقایسه کنید.</p>
<p>ثبت شرکت به‌تنهایی مشخص نمی‌کند که هر تراکنش قابل انجام است. <a href="https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework">چارچوب تحریم‌های ایران در استرالیا</a> شامل محدودیت‌هایی است که ممکن است بر خدمات مالی و پرداخت‌ها اثر بگذارد. پیش از واریز وجه، از ارائه‌دهنده بخواهید امکان پشتیبانی از هدف حواله، طرف‌های تراکنش و مسیر پرداخت را بررسی کند.</p>

<h2>۲. تکمیل احراز هویت</h2>
<p>ارائه‌دهنده مدارک موردنیاز را با توجه به شرایط شما مشخص می‌کند. ممکن است مدارک هویتی، اطلاعات آدرس، مشخصات گیرنده و توضیح هدف حواله یا منشأ وجه درخواست شود. مدارک را فقط از مسیر تأییدشده احراز هویت ارائه‌دهنده ارسال کنید.</p>
<p><a href="https://www.austrac.gov.au/industry-and-business/obligations-and-guidance/your-amlctf-program/customer-due-diligence">راهنمای شناسایی و ارزیابی مشتری AUSTRAC</a> بررسی‌های اولیه و مستمر را پوشش می‌دهد. پس از اولین حواله نیز ممکن است به به‌روزرسانی اطلاعات یا ارائه مدارک بیشتر نیاز باشد.</p>

<h2>۳. بررسی کامل نرخ و هزینه حواله</h2>
<p>مبلغ پرداختی به دلار استرالیا، نرخ تبدیل، کارمزدها و مبلغ دریافتی گیرنده را تأیید کنید. مشخص کنید مبلغ مقصد به تومان است یا ریال. مدت اعتبار نرخ و شرایط تأخیر در رسیدن وجه را از ارائه‌دهنده بپرسید.</p>
<p><a href="/fa/blog/rahnamaye-nerkh-aud-irt">راهنمای نرخ دلار استرالیا به تومان</a> روش مقایسه پیشنهادها را توضیح می‌دهد. در زرمان برای حواله‌های {{feeThreshold}} دلار و بیشتر هزینهٔ پرداخت صفر است و برای مبلغ‌های کمتر {{appliedFee}} دلار گرفته می‌شود. جزئیات در <a href="/fa/blog/karmozd-va-saghf-enteghal-pool">کارمزد و سقف انتقال پول از استرالیا به ایران</a> آمده است. قیمت لحظه‌ای را در <a href="/fa/rates">صفحهٔ نرخ دلار استرالیا</a> ببینید.</p>

<h2>۴. تأیید اطلاعات واریز</h2>
<p>از اطلاعات پرداختی استفاده کنید که از مسیر رسمی ارائه‌دهنده تأیید شده است. نام حساب، مبلغ و شناسه پرداخت را بررسی کنید. اگر اطلاعات تغییر کرده یا پیام غیرمنتظره‌ای دریافت کرده‌اید، پیش از پرداخت از راه ارتباطی معتبر و از قبل شناخته‌شده با ارائه‌دهنده تماس بگیرید.</p>
<p>نسخه‌ای از پیشنهاد نرخ، تأیید پرداخت و مکاتبات را نگه دارید. صرفاً به درخواست تماس‌گیرنده یا پیام ناشناس وجه بیشتری ارسال نکنید.</p>

<h2>۵. پیگیری تسویه و نگهداری رسید</h2>
<p>در زرمان حدود ۷۰٪ حواله‌ها کمتر از ۵ ساعت و ۹۵٪ کمتر از ۲۴ ساعت تسویه می‌شوند. زمان هر حواله به دریافت قطعی وجه، بررسی مدارک، ساعت کاری بانک‌های ایران و درستی مشخصات گیرنده بستگی دارد و تضمین‌شده نیست. راهکارهای کوتاه‌کردن این زمان را در <a href="/fa/blog/enteghal-sari-pool-az-australia-be-iran">انتقال سریع پول از استرالیا به ایران</a> بخوانید.</p>
<p>رسید نهایی را بررسی و دریافت وجه را با گیرنده تأیید کنید. در صورت تفاوت مبلغ یا اطلاعات با پیشنهاد توافق‌شده، سریعاً با ارائه‌دهنده تماس بگیرید.</p>

<h2>ثبت درخواست حواله در زرمان</h2>
<p>اگر می‌خواهید در جهت عکس پول بفرستید، <a href="/fa/blog/enteghal-pool-az-iran-be-australia">انتقال پول از ایران به استرالیا</a> را ببینید.</p>
<p>برای تکمیل احراز هویت و درخواست نرخ شخصی‌سازی‌شده، <a href="/fa/register">حساب کاربری ایجاد کنید</a>. در <a href="/fa/services">صفحه خدمات</a> درباره پرداخت‌های دانشجویی، کادر درمان، انتقال سرمایه و پرداخت‌های تجاری بیشتر بخوانید.</p>
    `.trim(),
  },
  // ─────────────────────── ADDED 2026-11: SEARCH GAPS ───────────────────────
  {
    slug: "can-you-send-money-to-iran",
    translationKey: "iran-transfer-rules",
    locale: "en",
    title: "Can You Send Money to Iran from Australia?",
    description:
      "What Australian sanctions and AUSTRAC rules mean for sending money to Iran, what a registered remittance provider must check, and how to verify a provider before you pay.",
    keywords: [
      "can I send money to Iran",
      "is it legal to send money to Iran",
      "send money to Iran from Australia rules",
      "Iran sanctions Australia remittance",
      "AUSTRAC registered remittance provider",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "DFAT: Iran sanctions framework", url: "https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework" },
      { title: "DFAT: Sanctions risks of incoming funds from Iran (March 2026)", url: "https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran" },
      { title: "DFAT: Consolidated List of sanctioned persons and entities", url: "https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list" },
      { title: "AUSTRAC: Remittance Sector Register", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "guides",
    categoryLabel: "Rules & Compliance",
    readingTime: 4,
    content: `
<p><strong>Australia's sanctions on Iran are targeted rather than a blanket ban on every payment.</strong> They restrict dealings with designated people and entities, certain goods and certain services and activities. Whether a particular transfer can go ahead depends on who is sending, who is receiving, the purpose and the payment route, so every transfer is checked before it is processed. This page is general information, not legal advice.</p>

<h2>What Do Australia's Iran Sanctions Cover?</h2>
<p>Australia applies two layers of sanctions to Iran: measures required by the UN Security Council and Australia's own autonomous sanctions. According to <a href="https://www.dfat.gov.au/international-relations/security/sanctions/sanctions-regimes/iran-sanctions-framework">DFAT's Iran sanctions framework</a>, they include:</p>
<ul>
  <li><strong>Designated persons and entities.</strong> You must not make money or assets available to anyone on the <a href="https://www.dfat.gov.au/international-relations/security/sanctions/consolidated-list">DFAT Consolidated List</a>, directly or indirectly.</li>
  <li><strong>Goods.</strong> Exports of arms and certain other listed goods are restricted.</li>
  <li><strong>Services and activities.</strong> Some services, including certain financial services connected to sanctioned goods or activities, are restricted.</li>
</ul>
<p>Sanctions change. Check DFAT's page for the measures in force on the day you send, and get independent legal advice for business, trade or large asset transfers.</p>

<h2>Can I Send Money to Family in Iran?</h2>
<p>Personal transfers, such as supporting parents or paying a family member's expenses, are handled through a registered remittance provider that checks the transfer first. The provider will verify your identity, check the recipient against sanctions lists, and may ask about the purpose of the transfer and where the money came from. If any check fails, the transfer cannot proceed.</p>
<p>Most Australian banks do not send international transfers to Iranian banks. That is why people in Australia usually use a remittance provider that settles the toman side in Iran.</p>

<h2>What Must a Registered Provider Do?</h2>
<ul>
  <li><strong>Be registered with AUSTRAC.</strong> Any business offering remittance services in Australia must be on the <a href="https://online.apps.austrac.gov.au/rsr/">Remittance Sector Register</a>.</li>
  <li><strong>Verify customers.</strong> Identity checks happen before your first transfer and may be repeated later.</li>
  <li><strong>Screen recipients.</strong> Names are checked against the DFAT Consolidated List and other risk lists.</li>
  <li><strong>Report to AUSTRAC.</strong> Providers report international transfers to AUSTRAC as a routine obligation. Cash transactions of AUD 10,000 or more are also reported. Reporting is standard practice and does not mean your transfer is suspicious.</li>
</ul>

<h2>What About Money Coming from Iran?</h2>
<p>In March 2026 DFAT published guidance on the <a href="https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran">sanctions risks of incoming funds from Iran</a>. Banks and remitters in Australia now look closely at where money from Iran originated. If you move savings or sale proceeds to Australia, expect to provide source-of-funds documents, such as a property sale contract or salary records. Our guide to <a href="/en/blog/send-money-iran-to-australia">sending money from Iran to Australia</a> explains the process.</p>

<h2>How to Check a Provider Before You Pay</h2>
<ol>
  <li>Search the provider's legal name or ABN on the AUSTRAC Remittance Sector Register. Zarman Exchange Pty Ltd is registered under <strong>IND100907570</strong> (ABN 70 692 742 957).</li>
  <li>Get the final rate, fees and recipient amount in writing before you pay.</li>
  <li>Only pay to account details shown in the provider's official dashboard or confirmed through a verified channel.</li>
  <li>Never split a cash deposit into smaller amounts to stay under a reporting threshold. Doing that to avoid reporting is an offence in Australia.</li>
</ol>

<h2>Next Steps</h2>
<p>Read <a href="/en/blog/send-money-australia-to-iran">how to send money from Australia to Iran</a>, check today's <a href="/en/rates">AUD to toman rate</a>, or <a href="/en/register">create an account</a> so we can review your transfer.</p>
    `.trim(),
  },
  {
    slug: "send-money-iran-to-australia",
    translationKey: "iran-to-australia-transfer",
    locale: "en",
    title: "Send Money from Iran to Australia: Toman to AUD",
    description:
      "How to move money from Iran to Australia for study, migration, rent or family support: paying in toman, receiving Australian dollars, Iranian bank limits and documents.",
    keywords: [
      "send money from Iran to Australia",
      "transfer money to Australia",
      "toman to AUD",
      "Iran to Australia money transfer",
      "student money transfer Australia",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "DFAT: Sanctions risks of incoming funds from Iran (March 2026)", url: "https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran" },
      { title: "AUSTRAC: Remittance Sector Register", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "guides",
    categoryLabel: "How-To Guides",
    readingTime: 4,
    content: `
<p><strong>With Zarman you pay toman into an Iranian bank account and receive Australian dollars in an Australian bank account.</strong> Families use it for tuition and living costs, new migrants use it to move savings before or after they arrive, and some people use it to cover a rental bond or visa costs.</p>

<h2>Who Uses Iran to Australia Transfers?</h2>
<ul>
  <li><strong>Students and their families</strong> paying tuition, OSHC health cover and living costs. See our <a href="/en/services/student-remittance">student payment service</a>.</li>
  <li><strong>New migrants</strong> moving savings to their own Australian account.</li>
  <li><strong>Renters</strong> paying a bond and the first weeks of rent. Rent in Australia is advertised per week and usually paid weekly or fortnightly. In NSW the bond is usually four weeks' rent and is lodged with NSW Fair Trading.</li>
  <li><strong>Families</strong> supporting a relative who already lives in Australia.</li>
</ul>

<h2>How Does It Work?</h2>
<ol>
  <li><strong>Register and verify your identity.</strong> Do this before the transfer is urgent.</li>
  <li><strong>Enter the amount</strong> in toman or Australian dollars and review the final rate and amount before you confirm. A quote and request stay valid for two hours.</li>
  <li><strong>Pay the toman</strong> to the account shown in your dashboard.</li>
  <li><strong>Receive AUD</strong> in the Australian account you nominated (BSB and account number).</li>
</ol>

<h2>Iranian Bank Transfer Limits</h2>
<p>How you pay the toman depends on the amount and your bank:</p>
<ul>
  <li><strong>Pol:</strong> up to 50,000,000 toman per transfer.</li>
  <li><strong>Paya:</strong> up to 200,000,000 toman per transfer.</li>
  <li><strong>Satna:</strong> for larger amounts.</li>
</ul>
<p>Your own bank may also set daily limits. Check them before you start, especially for tuition or a bond with a deadline.</p>

<h2>What Documents Might Be Needed?</h2>
<p>Banks and remitters in Australia check where money from Iran comes from. DFAT published guidance on this in <a href="https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran">March 2026</a>. Depending on the amount, we may ask for documents such as a property sale contract, salary records or a university invoice. For large amounts, use our <a href="/en/services/capital-and-asset-transfer">capital and asset transfer</a> service.</p>

<h2>Tips Before You Send</h2>
<ul>
  <li>Open your Australian bank account first. Several Australian banks let new migrants open an account before arrival and confirm identity in a branch later.</li>
  <li>Check today's <a href="/en/rates">toman to AUD rate</a>. The rate for Iran to Australia is different from the Australia to Iran rate.</li>
  <li>If a payment has a deadline, such as a tuition invoice, start a few business days early.</li>
</ul>

<p><a href="/en/register">Create an account</a> to request a quote for your transfer.</p>
    `.trim(),
  },
  {
    slug: "enteghal-sari-pool-az-australia-be-iran",
    translationKey: "fast-transfer-timing",
    locale: "fa",
    title: "انتقال سریع پول از استرالیا به ایران؛ چقدر طول می‌کشد؟",
    description:
      "حواله از استرالیا به ایران در زرمان معمولاً چند ساعت طول می‌کشد. ببینید زمان تسویه به چه چیزهایی بستگی دارد و چطور پولتان زودتر به حساب گیرنده برسد.",
    keywords: [
      "انتقال سریع پول از استرالیا به ایران",
      "انتقال پول از استرالیا به ایران",
      "حواله استرالیا به ایران چقدر طول می‌کشد",
      "انتقال دلار از استرالیا به ایران",
      "حواله فوری استرالیا",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "Osko و پرداخت‌های فوری در استرالیا (انگلیسی)", url: "https://www.auspayplus.com.au/solutions/osko" },
    ],
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 4,
    content: `
<p><strong>در زرمان حدود ۷۰٪ حواله‌ها کمتر از ۵ ساعت و ۹۵٪ کمتر از ۲۴ ساعت تسویه می‌شوند.</strong> زمان هر حواله به ساعت واریز شما، رسیدن دلار به حساب ما، کامل بودن اطلاعات گیرنده و ساعت کاری بانک‌های ایران بستگی دارد. این آمار زمان یک حوالهٔ مشخص را تضمین نمی‌کند.</p>

<h2>یک حواله از چه مرحله‌هایی تشکیل می‌شود؟</h2>
<ol>
  <li><strong>ثبت و تأیید درخواست.</strong> مبلغ و گیرنده را در پنل وارد می‌کنید و نرخ نهایی را می‌بینید.</li>
  <li><strong>واریز دلار استرالیا.</strong> مبلغ را به حسابی که در پنل اعلام شده واریز می‌کنید.</li>
  <li><strong>واریز تومان به گیرنده.</strong> بعد از تأیید دریافت دلار، تومان به حساب گیرنده در ایران واریز می‌شود.</li>
</ol>
<p>بیشتر تأخیرها در مرحلهٔ دوم و سوم پیش می‌آید. خبر خوب این است که بیشترشان قابل پیشگیری‌اند.</p>

<h2>چه چیزهایی حواله را کند می‌کند؟</h2>
<ul>
  <li><strong>اولین پرداخت به یک حساب جدید.</strong> بعضی بانک‌های استرالیا اولین انتقال به یک گیرندهٔ تازه را برای بررسی امنیتی چند ساعت نگه می‌دارند.</li>
  <li><strong>انتقال عادی به‌جای پرداخت فوری.</strong> انتقال‌هایی که با Osko انجام می‌شوند معمولاً در چند دقیقه می‌رسند. اگر بانک شما پرداخت فوری را برای آن حساب انجام ندهد، پول ممکن است تا روز کاری بعد برسد.</li>
  <li><strong>تعطیلی بانک‌های ایران.</strong> بانک‌های ایران جمعه‌ها و روزهای تعطیل رسمی کار نمی‌کنند. درخواستی که عصر پنجشنبه یا جمعه به وقت ایران تکمیل شود، ممکن است اولین روز کاری بعد به حساب گیرنده بنشیند.</li>
  <li><strong>اختلاف ساعت.</strong> سیدنی در تابستان استرالیا ۷ ساعت و نیم و در زمستان ۶ ساعت و نیم از تهران جلوتر است. ساعت ۹ صبح سیدنی در تابستان، ساعت ۱:۳۰ بامداد تهران است.</li>
  <li><strong>اطلاعات اشتباه گیرنده.</strong> اگر شماره شبا یا نام صاحب حساب درست نباشد، بانک واریز را برمی‌گرداند و حواله باید دوباره انجام شود.</li>
  <li><strong>احراز هویت ناتمام.</strong> اولین حواله یا مبلغ بالاتر ممکن است بررسی بیشتری لازم داشته باشد.</li>
</ul>

<h2>پنج کار برای اینکه پولتان زودتر برسد</h2>
<ol>
  <li>احراز هویت را قبل از روزی که به حواله نیاز دارید کامل کنید.</li>
  <li>گیرنده را یک بار با شماره شبای درست و نام دقیق صاحب حساب ذخیره کنید.</li>
  <li>بعد از دیدن نرخ نهایی، در مهلت اعتبار درخواست واریز کنید. نرخ و درخواست در زرمان ۲ ساعت اعتبار دارند.</li>
  <li>مبلغ و شرح واریز را دقیقاً همان‌طور که در پنل نوشته شده وارد کنید.</li>
  <li>اگر موعد مشخصی دارید، مثل اجاره یا قسط در ایران، یک روز کاری زودتر اقدام کنید.</li>
</ol>

<h2>چرا حواله مستقیم بانکی به ایران معمولاً ممکن نیست؟</h2>
<p>بیشتر بانک‌های استرالیا حوالهٔ بین‌المللی به بانک‌های ایران انجام نمی‌دهند. برای همین ایرانیان مقیم استرالیا معمولاً از صرافی‌های ثبت‌شده در AUSTRAC استفاده می‌کنند. صرافی دلار را در استرالیا دریافت می‌کند و معادل تومان آن را در ایران به حساب گیرنده واریز می‌کند. زرمان با شمارهٔ IND100907570 در <a href="https://online.apps.austrac.gov.au/rsr/">سامانه AUSTRAC</a> ثبت شده است.</p>

<h2>وضعیت حواله را از کجا ببینم؟</h2>
<p>وضعیت هر درخواست در پنل زرمان نمایش داده می‌شود و بعد از تسویه رسید دریافت می‌کنید. اگر سؤالی داشتید، پشتیبانی فارسی در واتس‌اپ در خدمتتان است.</p>

<h2>قبل از ارسال</h2>
<p><a href="/fa/rates">قیمت امروز دلار استرالیا به تومان</a> را ببینید، دربارهٔ <a href="/fa/blog/karmozd-va-saghf-enteghal-pool">کارمزد و سقف انتقال پول</a> بخوانید و برای ثبت درخواست <a href="/fa/register">حساب کاربری بسازید</a>.</p>
    `.trim(),
  },
  {
    slug: "karmozd-va-saghf-enteghal-pool",
    translationKey: "transfer-fees-limits",
    locale: "fa",
    title: "کارمزد و سقف انتقال پول از استرالیا به ایران",
    description:
      "هزینهٔ حواله از استرالیا به ایران از چه بخش‌هایی تشکیل می‌شود، کارمزد فعلی زرمان چقدر است، سقف مبلغ حواله چیست و کدام قوانین AUSTRAC به مبلغ‌های بالا مربوط می‌شود.",
    keywords: [
      "کارمزد انتقال ارز از استرالیا",
      "سقف انتقال پول از استرالیا به ایران",
      "هزینه حواله استرالیا به ایران",
      "کارمزد حواله دلار استرالیا",
      "قیمت حواله دلار استرالیا به ایران",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "AUSTRAC: مروری بر گزارش‌دهی (انگلیسی)", url: "https://www.austrac.gov.au/business/how-comply-guidance-and-resources/reporting/reporting-overview" },
      { title: "AUSTRAC: گزارش تراکنش‌های ۱۰٬۰۰۰ دلار و بیشتر (انگلیسی)", url: "https://www.austrac.gov.au/business/core-guidance/reporting/reporting-transactions-10000-and-over-threshold-transaction-reports-ttrs" },
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "rates",
    categoryLabel: "نرخ و هزینه",
    readingTime: 3,
    content: `
<p><strong>در زرمان برای حواله‌های {{feeThreshold}} دلار استرالیا و بیشتر، هزینهٔ پرداخت صفر است. برای مبلغ‌های کمتر، فقط {{appliedFee}} دلار گرفته می‌شود.</strong> بقیهٔ هزینهٔ حواله در نرخ تبدیل است، پس برای مقایسه همیشه مبلغ نهایی‌ای را ببینید که گیرنده در ایران دریافت می‌کند.</p>

<h2>هزینهٔ حواله از چه بخش‌هایی تشکیل می‌شود؟</h2>
<ul>
  <li><strong>نرخ تبدیل.</strong> اینکه به ازای هر دلار استرالیا چند تومان به گیرنده می‌رسد. بیشترین تفاوت بین صرافی‌ها همین‌جاست.</li>
  <li><strong>هزینهٔ ثابت پرداخت.</strong> در زرمان فقط برای مبلغ‌های کمتر از {{feeThreshold}} دلار.</li>
  <li><strong>هزینهٔ بانک خودتان.</strong> بیشتر حساب‌های روزمره در بانک‌های استرالیا برای انتقال داخلی هزینه‌ای نمی‌گیرند، اما شرایط حساب خودتان را بررسی کنید.</li>
</ul>

<h2>کارمزد فعلی زرمان</h2>
<table>
  <thead>
    <tr><th>مبلغ حواله</th><th>هزینهٔ پرداخت</th></tr>
  </thead>
  <tbody>
    <tr><td>کمتر از {{feeThreshold}} دلار استرالیا</td><td>{{appliedFee}} دلار</td></tr>
    <tr><td>{{feeThreshold}} دلار استرالیا و بیشتر</td><td>۰ دلار</td></tr>
  </tbody>
</table>
<p>مشتری‌هایی که حجم تراکنش بیشتری دارند ممکن است نرخ شخصی‌سازی‌شدهٔ بهتری بگیرند. نرخ و مبلغ نهایی شما قبل از تأیید در پنل نمایش داده می‌شود و ۲ ساعت اعتبار دارد.</p>

<h2>چطور دو پیشنهاد را درست مقایسه کنیم؟</h2>
<ol>
  <li>یک مبلغ ثابت دلاری انتخاب کنید، مثلاً ۲٬۰۰۰ دلار.</li>
  <li>از هر صرافی بپرسید گیرنده دقیقاً چند تومان دریافت می‌کند، بعد از کسر همهٔ هزینه‌ها.</li>
  <li>مطمئن شوید هر دو عدد به تومان است، نه یکی به ریال.</li>
  <li>مدت اعتبار نرخ را بپرسید. نرخی که تا زمان واریز شما عوض شود، نرخ واقعی نیست.</li>
</ol>
<p>عدد زرمان را همین حالا در <a href="/fa/rates">ماشین‌حساب نرخ دلار استرالیا</a> ببینید.</p>

<h2>سقف انتقال پول از استرالیا به ایران چقدر است؟</h2>
<p>قانون استرالیا سقف مشخصی برای مبلغ حواله تعیین نکرده است، اما هر صرافی سقف خودش را دارد و مبلغ‌های بالاتر بررسی بیشتری لازم دارند.</p>
<ul>
  <li><strong>سقف هر درخواست آنلاین در زرمان</strong> در فرم ثبت درخواست نمایش داده می‌شود.</li>
  <li><strong>برای مبلغ‌های بزرگ</strong>، مثل پول فروش ملک یا پس‌انداز، از خدمت <a href="/fa/services/capital-and-asset-transfer">انتقال سرمایه و دارایی</a> استفاده کنید تا مدارک و زمان‌بندی از قبل هماهنگ شود.</li>
  <li><strong>مدارک منشأ وجه.</strong> برای مبلغ‌های بالا ممکن است توضیح یا مدرکی دربارهٔ منشأ پول بخواهیم.</li>
</ul>

<h2>قوانین AUSTRAC دربارهٔ مبلغ‌های بالا</h2>
<ul>
  <li><strong>هر حوالهٔ بین‌المللی به AUSTRAC گزارش می‌شود.</strong> این کار روزمرهٔ همهٔ بانک‌ها و صرافی‌های استرالیاست و به این معنی نیست که حوالهٔ شما مشکلی دارد.</li>
  <li><strong>تراکنش‌های نقدی ۱۰٬۰۰۰ دلار و بیشتر</strong> هم گزارش می‌شوند.</li>
  <li><strong>تقسیم پول نقد به چند واریز کوچک</strong> برای فرار از این گزارش در استرالیا جرم است. اگر مبلغ بزرگی دارید، آن را یک‌جا و با مدارک درست منتقل کنید.</li>
</ul>

<h2>قدم بعدی</h2>
<p>دربارهٔ <a href="/fa/blog/enteghal-sari-pool-az-australia-be-iran">زمان تسویهٔ حواله</a> بخوانید یا برای دیدن نرخ شخصی‌سازی‌شدهٔ خودتان <a href="/fa/register">ثبت‌نام کنید</a>.</p>
    `.trim(),
  },
  {
    slug: "enteghal-pool-az-iran-be-australia",
    translationKey: "iran-to-australia-transfer",
    locale: "fa",
    title: "انتقال پول از ایران به استرالیا؛ تومان به دلار",
    description:
      "راهنمای انتقال پول از ایران به استرالیا برای تحصیل، مهاجرت، اجاره و کمک به خانواده: واریز تومان، دریافت دلار استرالیا، سقف پل و پایا و مدارک لازم.",
    keywords: [
      "انتقال پول از ایران به استرالیا",
      "انتقال پول به استرالیا",
      "حواله ارزی دانشجویی",
      "حواله دانشجویی استرالیا",
      "تبدیل تومان به دلار استرالیا",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "وزارت امور خارجه استرالیا: ریسک وجوه ورودی از ایران، مارس ۲۰۲۶ (انگلیسی)", url: "https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran" },
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
    ],
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 4,
    content: `
<p><strong>با زرمان در ایران تومان واریز می‌کنید و دلار استرالیا را در حساب بانکی خودتان یا عزیزتان در استرالیا دریافت می‌کنید.</strong> خانواده‌ها برای هزینهٔ تحصیل و زندگی دانشجو، مهاجرهای تازه برای انتقال پس‌انداز، و خیلی‌ها برای ودیعه و اجارهٔ اول از این مسیر استفاده می‌کنند.</p>

<h2>چه کسانی از ایران به استرالیا پول می‌فرستند؟</h2>
<ul>
  <li><strong>دانشجوها و خانواده‌هایشان</strong> برای شهریه، بیمهٔ OSHC و هزینهٔ زندگی. جزئیات در صفحهٔ <a href="/fa/services/student-remittance">حواله ارزی دانشجویی</a>.</li>
  <li><strong>مهاجرهای تازه</strong> که پس‌اندازشان را به حساب خودشان در استرالیا منتقل می‌کنند.</li>
  <li><strong>مستأجرها.</strong> اجاره در استرالیا هفتگی اعلام می‌شود و معمولاً هر هفته یا هر دو هفته یک بار پرداخت می‌شود. در NSW ودیعه (Bond) معمولاً معادل ۴ هفته اجاره است و نزد NSW Fair Trading نگهداری می‌شود.</li>
  <li><strong>خانواده‌هایی</strong> که به یکی از عزیزانشان در استرالیا کمک می‌کنند.</li>
</ul>

<h2>مراحل انتقال پول از ایران به استرالیا</h2>
<ol>
  <li><strong>ثبت‌نام و احراز هویت.</strong> این کار را قبل از روزی انجام دهید که پرداخت فوری لازم می‌شود.</li>
  <li><strong>ثبت درخواست.</strong> مبلغ را به تومان یا دلار وارد کنید و نرخ و مبلغ نهایی را قبل از تأیید ببینید. نرخ و درخواست ۲ ساعت اعتبار دارند.</li>
  <li><strong>واریز تومان</strong> به حسابی که در پنل اعلام می‌شود.</li>
  <li><strong>دریافت دلار استرالیا</strong> در حسابی که معرفی کرده‌اید (BSB و شماره حساب).</li>
</ol>

<h2>سقف انتقال در بانک‌های ایران</h2>
<p>روش واریز تومان به مبلغ و بانک شما بستگی دارد:</p>
<table>
  <thead>
    <tr><th>روش انتقال</th><th>سقف هر انتقال</th></tr>
  </thead>
  <tbody>
    <tr><td>پل</td><td>تا ۵۰ میلیون تومان</td></tr>
    <tr><td>پایا</td><td>تا ۲۰۰ میلیون تومان</td></tr>
    <tr><td>ساتنا</td><td>برای مبلغ‌های بالاتر</td></tr>
  </tbody>
</table>
<p>بانک خودتان هم ممکن است سقف روزانه داشته باشد. اگر موعد پرداخت دارید، مثل شهریه یا ودیعه، این سقف‌ها را از قبل بررسی کنید.</p>

<h2>چه مدارکی ممکن است لازم باشد؟</h2>
<p>بانک‌ها و صرافی‌های استرالیا منشأ پولی را که از ایران می‌آید بررسی می‌کنند. وزارت امور خارجهٔ استرالیا در <a href="https://www.dfat.gov.au/international-relations/security/sanctions/guidance/sanctions-risks-incoming-funds-iran">مارس ۲۰۲۶</a> راهنمای تازه‌ای در این باره منتشر کرده است. بسته به مبلغ، ممکن است مدارکی مثل قرارداد فروش ملک، فیش حقوقی یا صورت‌حساب دانشگاه بخواهیم. برای مبلغ‌های بزرگ از خدمت <a href="/fa/services/capital-and-asset-transfer">انتقال سرمایه و دارایی</a> استفاده کنید.</p>

<h2>چند نکته پیش از انتقال</h2>
<ul>
  <li>اول حساب بانکی استرالیا را باز کنید. چند بانک استرالیایی به مهاجرها اجازه می‌دهند قبل از ورود حساب باز کنند و بعد از رسیدن، هویتشان را در شعبه تأیید کنند.</li>
  <li><a href="/fa/rates">نرخ تبدیل تومان به دلار استرالیا</a> را ببینید. نرخ حوالهٔ ایران به استرالیا با نرخ حوالهٔ استرالیا به ایران فرق دارد.</li>
  <li>اگر پرداختی موعد دارد، مثل صورت‌حساب شهریه، چند روز کاری زودتر شروع کنید.</li>
</ul>

<p>برای دریافت نرخ حوالهٔ خودتان <a href="/fa/register">حساب کاربری بسازید</a>.</p>
    `.trim(),
  },
  {
    slug: "sarafi-irani-online-australia",
    translationKey: "online-exchange-australia",
    locale: "fa",
    title: "صرافی ایرانی آنلاین در استرالیا؛ از سیدنی تا پرث",
    description:
      "زرمان صرافی ایرانی کاملاً آنلاین در استرالیاست. از سیدنی، ملبورن، بریزبن، پرث یا هر شهر دیگری حواله بفرستید و پیش از اعتماد به یک صرافی آنلاین، این موارد را بررسی کنید.",
    keywords: [
      "صرافی ایرانی در سیدنی",
      "صرافی ایرانی در ملبورن",
      "صرافی استرالیا",
      "صرافی استرالیا به ایران",
      "صرافی دلار استرالیا",
    ],
    publishedAt: "2026-11-25",
    sources: [
      { title: "سامانه ثبت ارائه‌دهندگان حواله AUSTRAC (انگلیسی)", url: "https://online.apps.austrac.gov.au/rsr/" },
      { title: "ABN Lookup (انگلیسی)", url: "https://abr.business.gov.au/" },
      { title: "Scamwatch: کلاهبرداری‌های مالی (انگلیسی)", url: "https://www.scamwatch.gov.au/" },
    ],
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 3,
    content: `
<p><strong>زرمان صرافی کاملاً آنلاین است و دفتر حضوری ندارد.</strong> از هر شهری در استرالیا، از سیدنی و ملبورن تا بریزبن، پرث و آدلاید، می‌توانید با موبایل ثبت‌نام کنید، هویتتان را آنلاین تأیید کنید و بین دلار استرالیا و تومان حواله انجام دهید.</p>

<h2>صرافی آنلاین چطور کار می‌کند؟</h2>
<ul>
  <li><strong>بدون مراجعهٔ حضوری.</strong> ثبت‌نام، احراز هویت، دیدن نرخ و ثبت درخواست همه در پنل انجام می‌شود.</li>
  <li><strong>بدون پول نقد.</strong> واریز و دریافت فقط از طریق حساب بانکی است. اگر دنبال تبدیل حضوری اسکناس دلار آمریکا یا یورو هستید، این خدمت را ارائه نمی‌دهیم.</li>
  <li><strong>در هر دو جهت.</strong> هم از استرالیا به ایران و هم از ایران به استرالیا.</li>
  <li><strong>پشتیبانی فارسی</strong> در واتس‌اپ و تلگرام.</li>
</ul>

<h2>قبل از اعتماد به یک صرافی آنلاین، این چهار مورد را بررسی کنید</h2>
<ol>
  <li><strong>ثبت در AUSTRAC.</strong> هر کسب‌وکاری که در استرالیا حواله انجام می‌دهد باید در <a href="https://online.apps.austrac.gov.au/rsr/">سامانهٔ AUSTRAC</a> ثبت شده باشد. شمارهٔ ثبت زرمان IND100907570 است.</li>
  <li><strong>نام شرکت و ABN.</strong> نام ZARMAN EXCHANGE PTY LTD و ABN ‏70 692 742 957 را در <a href="https://abr.business.gov.au/">ABN Lookup</a> جست‌وجو کنید.</li>
  <li><strong>نرخ مکتوب قبل از واریز.</strong> نرخ، هزینه و مبلغ دریافتی گیرنده را قبل از پرداخت به‌صورت مکتوب ببینید.</li>
  <li><strong>اطلاعات واریز فقط از مسیر رسمی.</strong> حساب‌هایی را که یک پیام ناشناس در تلگرام یا واتس‌اپ می‌فرستد قبول نکنید. اطلاعات واریز زرمان فقط در پنل شما نمایش داده می‌شود.</li>
</ol>

<h2>اختلاف ساعت شهرهای استرالیا با تهران</h2>
<p>عددها نشان می‌دهند ساعت هر شهر چند ساعت از تهران جلوتر است.</p>
<table>
  <thead>
    <tr><th>شهر</th><th>تابستان استرالیا</th><th>زمستان استرالیا</th></tr>
  </thead>
  <tbody>
    <tr><td>سیدنی، ملبورن، کانبرا، هوبارت</td><td>۷:۳۰</td><td>۶:۳۰</td></tr>
    <tr><td>بریزبن</td><td>۶:۳۰</td><td>۶:۳۰</td></tr>
    <tr><td>آدلاید</td><td>۷:۰۰</td><td>۶:۰۰</td></tr>
    <tr><td>داروین</td><td>۶:۰۰</td><td>۶:۰۰</td></tr>
    <tr><td>پرث</td><td>۴:۳۰</td><td>۴:۳۰</td></tr>
  </tbody>
</table>
<p>بانک‌های ایران جمعه‌ها تعطیل‌اند. اگر صبح زود به وقت استرالیا حواله ثبت می‌کنید، در ایران هنوز نیمه‌شب است و واریز به گیرنده معمولاً بعد از شروع ساعت کاری بانک‌ها انجام می‌شود. دربارهٔ <a href="/fa/blog/enteghal-sari-pool-az-australia-be-iran">زمان تسویهٔ حواله</a> بیشتر بخوانید.</p>

<h2>شروع کنید</h2>
<p><a href="/fa/rates">قیمت امروز دلار استرالیا</a> را ببینید، <a href="/fa/blog/karmozd-va-saghf-enteghal-pool">کارمزد حواله</a> را بررسی کنید و برای ثبت اولین درخواست <a href="/fa/register">ثبت‌نام کنید</a>.</p>
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
