/**
 * Centralized UI string dictionary.
 * Import `useT` in any client component to get locale-aware strings.
 *
 * Usage:
 *   const t = useT();
 *   <span>{t.nav.home}</span>
 */

export type Locale = "fa" | "en";

const dict = {
  fa: {
    nav: {
      home: "خانه",
      calculator: "محاسبه‌گر",
      about: "درباره زرمان",
      services: "خدمات زرمان",
      howItWorks: "نحوه انتقال",
      contact: "تماس با ما",
      skipToContent: "پرش به محتوای اصلی",
    },
    auth: {
      login: "ورود",
      register: "ثبت‌نام",
      logout: "خروج",
      loginPage: "ورود به حساب",
      registerPage: "ثبت‌نام",
    },
    header: {
      dashboardNav: "ناوبری داشبورد",
      mainNav: "ناوبری اصلی",
      loginRegister: "ورود و ثبت‌نام",
      dashboard: "ZARMAN DASHBOARD",
      account: "حساب کاربری",
      transactions: "تاریخچه تراکنش‌ها",
      openMenu: "باز کردن منو",
      closeMenu: "بستن منو",
    },
    dashboard: {
      title: "پنل مدیریت تراکنش",
      welcome: "به پنل مدیریت تراکنش خوش آمدید.",
      welcomeDetail:
        "از اینجا می‌توانید ثبت نام خود را برای احراز هویت تکمیل کنید، درخواست تراکنش دهید، نرخ اختصاصی خود را ببینید و حواله‌های خود را مدیریت کنید.",
      kycApproved: "هویت تایید شده",
      kycPending: "در انتظار تایید هویت",
      accountSummary: "خلاصه وضعیت حساب",
      focusMode: "Focus Mode",
      normalMode: "Normal Mode",
      loading: "در حال بارگذاری...",
      connecting: "در حال برقراری اتصال با دیتابیس...",
      deleteConfirmTitle: "تایید حذف درخواست",
      deleteConfirmText: "آیا مطمئن هستید که می‌خواهید این درخواست را حذف کنید؟ این عمل غیرقابل بازگشت است.",
      deleteConfirm: "بله، حذف شود",
      deleteCancel: "انصراف",
      deleting: "در حال حذف...",
      tabs: {
        hub: "ثبت درخواست حواله",
        history: "سوابق تراکنش‌ها",
        profile: "احراز هویت",
        feedback: "بازخورد",
      },
    },
    stats: {
      approvedVolume: "حجم تبادلات تایید شده",
      successfulTx: "تعداد تراکنش‌های موفق",
      baseSellRate: "نرخ پایه فروش",
      baseBuyRate: "نرخ پایه خرید",
      tailoredRate: "نرخ اختصاصی شما",
      loyaltyPerTx: "تخفیف وفاداری هر تراکنش",
      totalSavings: "مجموع صرفه‌جویی وفاداری",
    },
    hub: {
      title: "محاسبه‌گر نرخ اختصاصی",
      txType: "نوع تراکنش ارزی از جانب مشتری",
      buyAud: "خرید AUD (تومان می‌دهم، دلار می‌گیرم)",
      sellAud: "فروش AUD (دلار می‌دهم، تومان می‌گیرم)",
      amountAud: "مقدار به دلار (AUD)",
      amountPayToman: "مبلغ نهایی پرداختی به تومان (IRT)",
      amountReceiveToman: "مبلغ نهایی دریافتی به تومان (IRT)",
      tomanHint: "می‌توانید مبلغ تومان را مستقیم وارد کنید تا مقدار دلار دقیقاً بر همان مبنا تنظیم شود.",
      recipient: "انتخاب گیرنده",
      addRecipient: "+ افزودن گیرنده جدید",
      eduPayment: "پرداخت برای آزمون، دانشگاه و ...",
      paymentLink: "لینک صفحه پرداخت",
      paymentLinkHint: "لینک صفحه پرداخت آزمون، دانشگاه یا موسسه مربوطه",
      sourceOfFunds: "منبع وجه (Source of Funds)",
      reasonForTransfer: "دلیل انتقال (Reason for Transfer)",
      promoCode: "کد تخفیف (اختیاری)",
      promoApply: "اعمال",
      promoSavings: "سود کد تخفیف:",
      yourRate: "نرخ اختصاصی شما:",
      rateOffline: "—",
      improvedRate: "بهبودیافته با کد تخفیف — نرخ پایه:",
      loyaltyThisTx: "شامل {{amount}} تومان سود وفاداری در این تراکنش.",
      loyaltyPerDollar: "شما {{amount}} تومان سود وفاداری روی هر دلار دارید.",
      requestedAmount: "مقدار درخواستی",
      fixedFee: "کارمزد ثابت",
      netSale: "مقدار خالص فروش",
      noFee: "بدون کارمزد",
      feeStatus: "وضعیت کارمزد",
      submitBtn: "تایید و ارسال به واتس‌اپ",
      processing: "در حال پردازش امن...",
      feeAddedBuy: "افزوده شدن {{fee}} دلار کارمزد",
      feeDeductedSell: "کسر {{fee}} دلار کارمزد",
      noFeeStatus: "بدون کارمزد",
      accessLimited: "دسترسی محدود است",
      accessLimitedText:
        "کاربر گرامی، برای ثبت درخواست ارزی ابتدا باید فرآیند احراز هویت شما تکمیل و توسط مدیریت تایید گردد.",
      accessLimitedKyc:
        "برای شروع، لطفاً از منوی بالای صفحه (سمت راست) وارد بخش «احراز هویت» شده و مدارک خود را تکمیل نمایید.",
      marketPaused: "بازار موقتاً متوقف شده است",
      marketPausedDefault:
        "در حال حاضر امکان ثبت درخواست وجود ندارد. لطفاً بعداً مراجعه کنید.",
      rateOfflineTitle: "ارتباط با سرور جهانی نرخ قطع است",
      rateOfflineText:
        "متاسفانه در حال حاضر دریافت نرخ لحظه‌ای امکان‌پذیر نیست. ثبت تراکنش موقتاً غیرفعال شده است. لطفاً دقایقی دیگر تلاش کنید.",
      validityNotice:
        "توجه: این نرخ و درخواست دارای اعتبار زمانی ۲ ساعته است و باید در این بازه زمانی نهایی شود.\nهمچنین، درخواست‌کننده و شخصی که اطلاعاتش در سیستم ثبت شده، باید همان صاحب حسابی باشد که وجه از آن انتقال می‌یابد.",
      allFieldsRequired:
        "لطفاً تمامی فیلدهای اجباری (ستاره‌دار) را تکمیل نمایید.",
      paymentLinkRequired: "لطفاً لینک صفحه پرداخت را وارد کنید.",
      scrollIndicator: "فرم درخواست حواله",
    },
  },
  en: {
    nav: {
      home: "Home",
      calculator: "Calculator",
      about: "About Zarman",
      services: "Services",
      howItWorks: "How It Works",
      contact: "Contact",
      skipToContent: "Skip to main content",
    },
    auth: {
      login: "Log In",
      register: "Sign Up",
      logout: "Log Out",
      loginPage: "Sign In",
      registerPage: "Create Account",
    },
    header: {
      dashboardNav: "Dashboard navigation",
      mainNav: "Main navigation",
      loginRegister: "Login & Register",
      dashboard: "ZARMAN DASHBOARD",
      account: "Account",
      transactions: "Transaction History",
      openMenu: "Open menu",
      closeMenu: "Close menu",
    },
    dashboard: {
      title: "Transaction Management Panel",
      welcome: "Welcome to your transaction panel.",
      welcomeDetail:
        "From here you can complete identity verification, submit transaction requests, view your personalised rate, and manage your remittances.",
      kycApproved: "Identity Verified",
      kycPending: "Pending Identity Verification",
      accountSummary: "Account Summary",
      focusMode: "Focus Mode",
      normalMode: "Normal Mode",
      loading: "Loading...",
      connecting: "Connecting to database...",
      deleteConfirmTitle: "Confirm Delete Request",
      deleteConfirmText:
        "Are you sure you want to delete this request? This action cannot be undone.",
      deleteConfirm: "Yes, Delete",
      deleteCancel: "Cancel",
      deleting: "Deleting...",
      tabs: {
        hub: "Submit Transaction Request",
        history: "Transaction History",
        profile: "Identity Verification",
        feedback: "Feedback",
      },
    },
    stats: {
      approvedVolume: "Approved Transaction Volume",
      successfulTx: "Successful Transactions",
      baseSellRate: "Base Sell Rate",
      baseBuyRate: "Base Buy Rate",
      tailoredRate: "Your Personalised Rate",
      loyaltyPerTx: "Loyalty Discount Per Transaction",
      totalSavings: "Total Loyalty Savings",
    },
    hub: {
      title: "Personalised Rate Calculator",
      txType: "Transaction Type",
      buyAud: "Buy AUD (Pay Toman, receive AUD)",
      sellAud: "Sell AUD (Send AUD, receive Toman)",
      amountAud: "Amount in AUD",
      amountPayToman: "Final amount payable in Toman (IRT)",
      amountReceiveToman: "Final amount receivable in Toman (IRT)",
      tomanHint:
        "You can enter the Toman amount directly and the AUD figure will be calculated automatically.",
      recipient: "Select Recipient",
      addRecipient: "+ Add New Recipient",
      eduPayment: "Payment for Exam, University & more",
      paymentLink: "Payment Page Link",
      paymentLinkHint: "Link to the exam, university, or institution payment page",
      sourceOfFunds: "Source of Funds",
      reasonForTransfer: "Reason for Transfer",
      promoCode: "Promo Code (Optional)",
      promoApply: "Apply",
      promoSavings: "Promo savings:",
      yourRate: "Your personalised rate:",
      rateOffline: "—",
      improvedRate: "Improved with promo code — base rate:",
      loyaltyThisTx: "Includes {{amount}} Toman loyalty benefit on this transaction.",
      loyaltyPerDollar: "You earn {{amount}} Toman loyalty benefit per dollar.",
      requestedAmount: "Requested Amount",
      fixedFee: "Fixed Fee",
      netSale: "Net Sale Amount",
      noFee: "No Fee",
      feeStatus: "Fee Status",
      submitBtn: "Confirm & Send via WhatsApp",
      processing: "Processing securely...",
      feeAddedBuy: "{{fee}} AUD fee added",
      feeDeductedSell: "{{fee}} AUD fee deducted",
      noFeeStatus: "No fee",
      accessLimited: "Access Restricted",
      accessLimitedText:
        "Dear user, to submit a remittance request you must first complete identity verification and receive management approval.",
      accessLimitedKyc:
        "To get started, please navigate to the 'Identity Verification' section from the top menu and complete your documents.",
      marketPaused: "Market Temporarily Paused",
      marketPausedDefault:
        "Requests cannot be submitted at this time. Please try again later.",
      rateOfflineTitle: "Live Rate Server Unavailable",
      rateOfflineText:
        "Live rate retrieval is currently unavailable. Transaction submission has been temporarily disabled. Please try again in a few minutes.",
      validityNotice:
        "Notice: This rate and request is valid for 2 hours and must be finalised within this window.\nAdditionally, the requester and the account holder on file must be the same person from whom the funds are transferred.",
      allFieldsRequired: "Please complete all required fields (marked with *).",
      paymentLinkRequired: "Please enter the payment page link.",
      scrollIndicator: "Remittance Request Form",
    },
  },
} as const;

export type Dictionary = typeof dict.fa;

export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? (dict.en as unknown as Dictionary) : dict.fa;
}
