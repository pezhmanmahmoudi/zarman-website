export interface BlogPost {
  slug: string;
  locale: "en" | "fa";
  title: string;
  description: string;
  keywords: string[];
  publishedAt: string; // ISO date string
  category: string;
  categoryLabel: string;
  readingTime: number; // minutes
  content: string; // trusted HTML — never from user input
}

export const blogPosts: BlogPost[] = [
  // ─────────────────────────────── ENGLISH ────────────────────────────────
  {
    slug: "aud-to-irt-exchange-rate-guide",
    locale: "en",
    title: "AUD to IRT Exchange Rate: How It Works &amp; How to Get the Best Rate",
    description:
      "Understand how the AUD to IRT exchange rate is calculated, what factors move it, and how Zarman's volume-based loyalty pricing gives you a better rate on every transfer.",
    keywords: [
      "AUD to IRT exchange rate",
      "AUD to toman",
      "dollar to toman Australia",
      "AUD IRT rate today",
      "best exchange rate Australia Iran",
    ],
    publishedAt: "2026-04-15",
    category: "rates",
    categoryLabel: "Exchange Rates",
    readingTime: 5,
    content: `
<p>The <strong>AUD to IRT exchange rate</strong> — how many Iranian Toman (IRT) you receive per Australian Dollar (AUD) — is one of the most searched financial questions among the Iranian-Australian community. Understanding how this rate is set, what makes it move, and how to time your transfer can save a meaningful amount on every transaction.</p>

<h2>What Is the AUD/IRT Rate?</h2>
<p>Unlike major pairs such as AUD/USD that trade freely on global forex markets, the AUD/IRT rate is derived indirectly. There is no official, freely traded AUD/IRT market. Providers calculate it by combining two components:</p>
<ul>
  <li>The live <strong>AUD/USD</strong> rate from global markets</li>
  <li>The prevailing <strong>USD/IRT</strong> open-market (Sana) rate inside Iran</li>
</ul>
<p>On top of this derived mid-market rate, every provider adds a margin to cover costs and generate revenue. The size of that margin is where providers differ significantly.</p>

<h2>What Moves the AUD/IRT Rate?</h2>
<p><strong>Reserve Bank of Australia (RBA) decisions:</strong> When the RBA raises interest rates, the AUD typically strengthens against the USD — which flows through to a better Toman yield per dollar for senders in Australia.</p>
<p><strong>Global commodity prices:</strong> Australia is a major exporter of iron ore, coal, and gold. Rising commodity prices tend to lift the AUD, improving your transfer value.</p>
<p><strong>Iran's domestic monetary conditions:</strong> Inflation, Central Bank of Iran policy, and domestic demand for foreign currency all affect the USD/IRT open-market rate. High domestic demand for USD inside Iran typically lifts the IRT you receive per dollar.</p>
<p><strong>Corridor supply and demand:</strong> During peak periods — Nowruz (Persian New Year), university enrolment season, or property settlement cycles — increased demand in the Australia-Iran corridor can temporarily compress margins as providers manage liquidity.</p>

<h2>Mid-Market Rate vs. Transfer Rate</h2>
<p>The <em>mid-market rate</em> (the rate you see on Google or currency sites) is the mathematical midpoint between the wholesale buy and sell price. No retail or remittance service offers this rate — all providers add a margin.</p>
<p>The key question is: <strong>how transparent is that margin?</strong> A trustworthy provider shows you the exact rate you will receive — and the total amount the recipient gets — before you confirm. Hidden fees added at the last step are a red flag.</p>

<h2>How Zarman Calculates Your Personalised Rate</h2>
<p>Zarman Exchange uses a <strong>volume-based, loyalty-linked pricing model</strong> rather than a single flat rate for all customers:</p>
<ul>
  <li><strong>Transaction volume:</strong> Larger single transfers attract a tighter margin, meaning more Toman per dollar for you.</li>
  <li><strong>Loyalty credit:</strong> Every AUD 5,000 in cumulative transactions earns loyalty credit. This credit progressively improves your rate on subsequent transfers.</li>
  <li><strong>Live market conditions:</strong> Rates reflect the live AUD/IRT rate at the time your request is confirmed.</li>
</ul>
<p>Your personalised rate is always displayed in your <a href="/en/register">client dashboard</a> before you commit to the transaction — no surprises, no hidden fees.</p>

<h2>Practical Tips for a Better Rate</h2>
<ol>
  <li><strong>Consolidate transfers where possible.</strong> One larger transaction typically attracts a better rate than several small ones.</li>
  <li><strong>Watch for AUD strength.</strong> When the Australian Dollar is at a relative high — often correlated with strong commodity prices — you lock in more Toman per dollar.</li>
  <li><strong>Build your loyalty balance.</strong> Consistent use of Zarman progressively improves your rate over time at no extra cost.</li>
  <li><strong>Use an AUSTRAC-registered provider.</strong> Registered dealers are legally required to maintain transparent pricing practices. You can verify any provider's status on the <a href="https://online.apps.austrac.gov.au/rsr/" target="_blank" rel="noopener noreferrer">AUSTRAC Remittance Sector Register</a>.</li>
</ol>

<h2>Ready to Check Today's Rate?</h2>
<p>Zarman's live rate calculator on the <a href="/en">homepage</a> shows the current AUD/IRT rate in real time. <a href="/en/register">Register</a> to see your personalised rate based on your specific transfer amount and transaction history.</p>
    `.trim(),
  },

  {
    slug: "send-money-australia-to-iran",
    locale: "en",
    title: "How to Send Money from Australia to Iran in 2026: A Complete Guide",
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
    category: "guides",
    categoryLabel: "How-To Guides",
    readingTime: 6,
    content: `
<p>Sending money from Australia to Iran involves navigating Australian regulatory requirements, understanding what makes a provider trustworthy, and knowing what to expect at each stage. This guide covers every step clearly.</p>

<h2>Step 1: Choose an AUSTRAC-Registered Provider</h2>
<p>In Australia, every business offering remittance services must be registered with <strong>AUSTRAC</strong> (Australian Transaction Reports and Analysis Centre). Operating without AUSTRAC registration is a criminal offence under the <em>Anti-Money Laundering and Counter-Terrorism Financing Act 2006</em>.</p>
<p>Before using any service, search for the provider on the <a href="https://online.apps.austrac.gov.au/rsr/" target="_blank" rel="noopener noreferrer">AUSTRAC Remittance Sector Register</a> — it is publicly accessible. Zarman Exchange's registration number is <strong>100907570</strong>. You can also read more about our credentials on our <a href="/en/about">About &amp; Compliance page</a>.</p>
<p>Using an unregistered provider exposes you to serious risks: loss of funds with no legal recourse, and potential involvement in illicit financial activity. The "better rate" offered by unregistered services is not worth this risk.</p>

<h2>Step 2: Complete Identity Verification (KYC)</h2>
<p>All AUSTRAC-registered dealers are legally required to verify client identity before processing transactions — this is called <strong>Know Your Customer (KYC)</strong> compliance. Typically you will need:</p>
<ul>
  <li>A valid government-issued photo ID (Australian passport, driver's licence, or visa document)</li>
  <li>Proof of current Australian address (utility bill or bank statement dated within 3 months)</li>
  <li>A digital selfie or live video for online KYC platforms</li>
</ul>
<p>Once verified, your identity is stored securely. You will not need to repeat the process for subsequent transactions with the same provider.</p>

<h2>Step 3: Request Your Rate and Submit the Transfer</h2>
<p>A transparent provider will show you — <em>before you confirm</em> — the exact exchange rate, any applicable fees, the AUD amount you transfer, and the exact IRT amount the recipient will receive. If a provider cannot give you these four numbers upfront, look elsewhere.</p>
<p>At Zarman, this is done through your client dashboard. Enter the AUD amount, view your personalised rate (based on your transaction history and volume), then confirm. The rate is locked at confirmation.</p>

<h2>Step 4: Transfer Funds to the Provider's Australian Account</h2>
<p>After confirming your rate, you receive Australian bank account details for the transfer. Send the AUD amount from your Australian bank via BSB/account number or PayID.</p>
<p><strong>Important:</strong> Only ever transfer to an Australian bank account registered to the licensed business entity. Never send to a personal account or an overseas "collection account" — this is a common pattern in remittance fraud.</p>

<h2>Step 5: Recipient Receives Funds in Iran</h2>
<p>Once your AUD payment clears, the provider converts it at the agreed rate and transfers to the nominated Iranian bank account. With a well-capitalised provider, this can complete within a few hours to one business day. You should receive a confirmation receipt with the transaction details, rate applied, and amount credited.</p>

<h2>Common Mistakes to Avoid</h2>
<ul>
  <li><strong>Not verifying AUSTRAC registration</strong> before transferring any funds</li>
  <li><strong>Accepting "no fee" framing</strong> without checking the exchange rate margin — all costs are somewhere</li>
  <li><strong>Sending to unverified accounts</strong> presented by unknown parties as official collection points</li>
  <li><strong>Ignoring the settlement timeframe</strong> — always confirm when the recipient will actually receive the funds</li>
</ul>

<h2>Start Your Transfer with Zarman</h2>
<p>Zarman Exchange is AUSTRAC-registered (ABN 70 692 742 957, Registration 100907570), offers personalised volume-based rates, and provides full transaction tracking via your client dashboard. <a href="/en/register">Register today</a> to receive your personalised rate.</p>
    `.trim(),
  },

  // ─────────────────────────────── PERSIAN ────────────────────────────────
  {
    slug: "rahnamaye-nerkh-aud-irt",
    locale: "fa",
    title: "نرخ دلار استرالیا به تومان | راهنمای کامل محاسبه و دریافت بهترین نرخ",
    description:
      "راهنمای کامل نرخ تبدیل دلار استرالیا (AUD) به تومان ایران (IRT). عوامل مؤثر بر نرخ، تفاوت نرخ بازار و نرخ انتقال، و نحوه دریافت بهترین نرخ از صرافی زرمان.",
    keywords: [
      "نرخ دلار استرالیا به تومان",
      "دلار استرالیا به تومان امروز",
      "نرخ AUD به IRT",
      "نرخ ارز استرالیا",
      "بهترین نرخ صرافی استرالیا",
    ],
    publishedAt: "2026-04-15",
    category: "rates",
    categoryLabel: "نرخ ارز",
    readingTime: 5,
    content: `
<p>نرخ تبدیل <strong>دلار استرالیا (AUD) به تومان ایران (IRT)</strong> یکی از پرجستجوترین موضوعات مالی در میان جامعه ایرانیان مقیم استرالیاست. درک نحوه تعیین این نرخ، عوامل مؤثر بر آن، و زمان‌بندی مناسب برای انتقال می‌تواند در هر تراکنش مبلغ قابل‌توجهی را به نفع شما تغییر دهد.</p>

<h2>نرخ AUD/IRT چگونه تعیین می‌شود؟</h2>
<p>برخلاف جفت‌ارزهای اصلی که در بازارهای فارکس جهانی معامله می‌شوند، نرخ AUD/IRT به صورت غیرمستقیم محاسبه می‌شود و از دو بخش تشکیل شده است:</p>
<ul>
  <li>نرخ زنده <strong>AUD/USD</strong> در بازارهای جهانی</li>
  <li>نرخ بازار آزاد <strong>USD/IRT</strong> (سنا) در داخل ایران</li>
</ul>
<p>بر این نرخ میانگین بازار، هر ارائه‌دهنده‌ای حاشیه‌ای برای پوشش هزینه و کسب درآمد اضافه می‌کند. اندازه این حاشیه جایی است که ارائه‌دهندگان تفاوت معنادار دارند.</p>

<h2>چه عواملی بر نرخ AUD/IRT تأثیر می‌گذارند؟</h2>
<p><strong>تصمیمات بانک مرکزی استرالیا (RBA):</strong> افزایش نرخ بهره توسط RBA معمولاً AUD را در برابر USD تقویت می‌کند که به بازده تومان بهتری به ازای هر دلار منجر می‌شود.</p>
<p><strong>قیمت کامودیتی‌های جهانی:</strong> استرالیا صادرکننده بزرگ سنگ‌آهن، زغال‌سنگ و طلاست. افزایش قیمت این کالاها معمولاً AUD را تقویت می‌کند.</p>
<p><strong>شرایط پولی داخلی ایران:</strong> تورم، سیاست بانک مرکزی ایران و تقاضای داخلی برای ارز خارجی بر نرخ USD/IRT تأثیر می‌گذارد و به نرخ AUD/IRT منتقل می‌شود.</p>
<p><strong>عرضه و تقاضا در این کریدور:</strong> در دوره‌های پرتقاضا — نوروز، فصل ثبت‌نام دانشگاه‌ها یا معاملات ملکی — تقاضای بالا ممکن است حاشیه را موقتاً فشرده کند.</p>

<h2>تفاوت نرخ میانگین بازار و نرخ انتقال</h2>
<p><em>نرخ میانگین بازار</em> (interbank rate) میانگین قیمت خرید و فروش در بازار عمده‌فروشی است و همان نرخی است که در گوگل می‌بینید. هیچ سرویسی این نرخ را به مصرف‌کننده ارائه نمی‌دهد — همه ارائه‌دهندگان حاشیه‌ای اضافه می‌کنند.</p>
<p>سؤال کلیدی این است: <strong>این حاشیه چقدر شفاف است؟</strong> یک ارائه‌دهنده معتبر دقیقاً قبل از تأیید به شما می‌گوید چه نرخی دریافت می‌کنید و گیرنده چقدر تومان دریافت می‌کند.</p>

<h2>نحوه محاسبه نرخ در زرمان</h2>
<p>صرافی زرمان به جای نرخ ثابت برای همه مشتریان، از <strong>مدل قیمت‌گذاری حجم‌محور و وفاداری‌محور</strong> استفاده می‌کند:</p>
<ul>
  <li><strong>حجم تراکنش:</strong> انتقال‌های بزرگ‌تر حاشیه کمتری دارند و تومان بیشتری به ازای هر دلار به شما می‌رسد.</li>
  <li><strong>اعتبار وفاداری:</strong> به ازای هر ۵۰۰۰ دلار تراکنش تجمعی، اعتبار وفاداری کسب می‌کنید که نرخ انتقال‌های بعدی را بهتر می‌کند.</li>
  <li><strong>شرایط زنده بازار:</strong> نرخ شما منعکس‌کننده نرخ زنده AUD/IRT در زمان تأیید درخواست است.</li>
</ul>
<p>نرخ اختصاصی شما همیشه در <a href="/fa/register">پنل کاربری</a> قبل از تأیید تراکنش نمایش داده می‌شود — بدون هزینه پنهان.</p>

<h2>نکاتی برای دریافت بهترین نرخ</h2>
<ol>
  <li><strong>تراکنش‌ها را تجمیع کنید.</strong> یک انتقال بزرگ معمولاً نرخ بهتری از چند انتقال کوچک دارد.</li>
  <li><strong>قدرت AUD را رصد کنید.</strong> وقتی دلار استرالیا در سطح بالایی قرار دارد، تومان بیشتری به ازای هر دلار دریافت می‌کنید.</li>
  <li><strong>اعتبار وفاداری خود را بسازید.</strong> استفاده مستمر از زرمان نرخ شما را به‌تدریج بهبود می‌دهد.</li>
  <li><strong>از صرافی ثبت‌شده نزد AUSTRAC استفاده کنید.</strong> می‌توانید وضعیت هر صرافی را در <a href="https://online.apps.austrac.gov.au/rsr/" target="_blank" rel="noopener noreferrer">سامانه رسمی AUSTRAC</a> تأیید کنید.</li>
</ol>

<h2>نرخ امروز را بررسی کنید</h2>
<p>ماشین‌حساب زنده زرمان در <a href="/fa">صفحه اصلی</a> نرخ لحظه‌ای AUD/IRT را نشان می‌دهد. <a href="/fa/register">ثبت‌نام کنید</a> تا نرخ شخصی‌سازی‌شده خود را بر اساس مبلغ و سابقه تراکنش‌تان ببینید.</p>
    `.trim(),
  },

  {
    slug: "havaleh-az-australia-be-iran",
    locale: "fa",
    title: "حواله از استرالیا به ایران | راهنمای جامع ۲۰۲۶",
    description:
      "راهنمای گام‌به‌گام ارسال حواله از استرالیا به ایران. از انتخاب صرافی مجاز AUSTRAC تا دریافت وجه توسط گیرنده در ایران — همه چیز را بدانید.",
    keywords: [
      "حواله از استرالیا به ایران",
      "انتقال پول از استرالیا به ایران",
      "ارسال پول به ایران از استرالیا",
      "صرافی مجاز استرالیا",
      "AUSTRAC صرافی",
    ],
    publishedAt: "2026-04-22",
    category: "guides",
    categoryLabel: "راهنماها",
    readingTime: 6,
    content: `
<p>ارسال حواله از استرالیا به ایران نیازمند آشنایی با قوانین نظارتی استرالیا و واقعیت‌های عملی این کریدور مالی است. این راهنما همه مراحل را به وضوح پوشش می‌دهد — از انتخاب صرافی مناسب تا تکمیل اولین تراکنش.</p>

<h2>مرحله اول: انتخاب صرافی ثبت‌شده نزد AUSTRAC</h2>
<p>در استرالیا، هر کسب‌وکاری که خدمات حواله ارائه می‌دهد باید نزد <strong>AUSTRAC</strong> (سازمان اطلاعات مالی استرالیا) ثبت‌شده باشد. فعالیت بدون ثبت AUSTRAC طبق قانون مبارزه با پول‌شویی ۲۰۰۶ (AML/CTF Act) جرم کیفری محسوب می‌شود.</p>
<p>قبل از استفاده از هر سرویسی، ثبت آن را در <a href="https://online.apps.austrac.gov.au/rsr/" target="_blank" rel="noopener noreferrer">سامانه رسمی AUSTRAC</a> تأیید کنید. شماره ثبت زرمان اکسچنج <strong>100907570</strong> است. اطلاعات بیشتر درباره مجوزها را در <a href="/fa/about">صفحه درباره زرمان</a> مشاهده کنید.</p>
<p>استفاده از صرافی غیرمجاز شما را در معرض خطرات جدی قرار می‌دهد: از دست دادن وجه بدون امکان پیگیری قانونی. نرخ «بهتر» ارائه‌شده توسط سرویس‌های غیرمجاز ارزش این ریسک را ندارد.</p>

<h2>مرحله دوم: احراز هویت (KYC)</h2>
<p>تمام صرافی‌های ثبت‌شده نزد AUSTRAC طبق قانون موظفند پیش از پردازش تراکنش، هویت مشتریان را تأیید کنند — این فرآیند <strong>KYC</strong> (شناخت مشتری) نام دارد. معمولاً به موارد زیر نیاز دارید:</p>
<ul>
  <li>مدرک شناسایی معتبر با عکس (پاسپورت استرالیایی، گواهینامه رانندگی یا مدرک ویزا)</li>
  <li>مدرک آدرس فعلی استرالیایی (قبض خدمات شهری یا صورت‌حساب بانکی مربوط به سه ماه اخیر)</li>
  <li>تأیید هویت دیجیتال (سلفی یا ویدیو زنده برای پلتفرم‌های KYC آنلاین)</li>
</ul>
<p>پس از تأیید یک‌بار، برای تراکنش‌های بعدی با همان ارائه‌دهنده نیازی به تکرار این فرآیند نیست.</p>

<h2>مرحله سوم: درخواست نرخ و ثبت حواله</h2>
<p>یک ارائه‌دهنده شفاف قبل از تأیید موارد زیر را به شما نشان می‌دهد: نرخ دقیق تبدیل، هزینه‌های احتمالی، مبلغ AUD که واریز می‌کنید، و مبلغ دقیق IRT که گیرنده دریافت می‌کند. اگر ارائه‌دهنده‌ای این چهار عدد را از پیش اعلام نمی‌کند، گزینه دیگری انتخاب کنید.</p>
<p>در زرمان این فرآیند از طریق پنل کاربری انجام می‌شود. مبلغ AUD را وارد می‌کنید، نرخ شخصی خود را مشاهده می‌کنید و سپس تأیید می‌کنید. نرخ در زمان تأیید قفل می‌شود.</p>

<h2>مرحله چهارم: واریز وجه به حساب استرالیایی صرافی</h2>
<p>پس از تأیید نرخ، اطلاعات حساب بانکی استرالیایی صرافی در اختیار شما قرار می‌گیرد. مبلغ AUD را از حساب بانکی خود در استرالیا از طریق BSB/شماره حساب یا PayID منتقل کنید.</p>
<p><strong>مهم:</strong> فقط به حساب‌های بانکی در استرالیا که به نام شرکت مجاز ثبت شده‌اند واریز کنید. هیچ‌گاه به حساب‌های شخصی یا «حساب‌های جمع‌آوری» در خارج از کشور پول نفرستید — این الگوی رایج کلاهبرداری در حوزه حواله است.</p>

<h2>مرحله پنجم: دریافت وجه توسط گیرنده در ایران</h2>
<p>پس از دریافت پرداخت AUD، صرافی آن را به نرخ توافق‌شده به IRT تبدیل کرده و به حساب بانکی ایرانی مشخص‌شده منتقل می‌کند. برای صرافی‌های معتبر با مدیریت نقدینگی مناسب، این فرآیند در چند ساعت تا یک روز کاری قابل انجام است. رسید رسمی تراکنش به ایمیل شما ارسال می‌شود.</p>

<h2>نکاتی برای انتخاب صرافی مناسب</h2>
<ul>
  <li><strong>ثبت AUSTRAC</strong> — قابل تأیید در سامانه عمومی</li>
  <li><strong>قیمت‌گذاری شفاف</strong> — نرخ و هزینه‌ها قبل از تأیید اعلام می‌شود</li>
  <li><strong>زمان تسویه مشخص</strong> — از قبل اعلام شده، نه «هر چه زودتر»</li>
  <li><strong>پشتیبانی مشتری</strong> — از طریق واتساپ، ایمیل یا تلفن</li>
  <li><strong>KYC دیجیتال</strong> — احراز هویت سریع آنلاین، بدون نیاز به مراجعه حضوری</li>
</ul>

<h2>شروع حواله با زرمان</h2>
<p>زرمان اکسچنج دارای مجوز AUSTRAC (ABN: 70 692 742 957، شماره ثبت: 100907570) است، نرخ‌های شخصی‌سازی‌شده بر اساس حجم ارائه می‌دهد، و ردیابی کامل تراکنش را از طریق پنل کاربری فراهم می‌کند. <a href="/fa/register">همین حالا ثبت‌نام کنید</a> تا نرخ اختصاصی خود را دریافت کنید.</p>
    `.trim(),
  },
];
