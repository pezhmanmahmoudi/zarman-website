import { isMobileOS } from "../isMobile";

// استفاده شده در کامپوننت‌های Hero و AboutSection
export const WHATSAPP_NUMBER = "61497851631";

// استفاده شده در کامپوننت‌های FinalCTA، MobHeader و HowItWorks
export const WHATSAPP_MESSAGE_TRANSFER_HELP =
  "سلام، من از طریق وب‌سایت زرمان پیام می‌دهم و برای انتقال وجه نیاز به راهنمایی دارم.";

export const WHATSAPP_MESSAGE_SIGNUP_HELP =
  "سلام. وقت بخیر. من برای ثبت‌نام و انجام تراکنش در صرافی زرمان نیاز به راهنمایی دارم.";

export const buildWhatsAppUrl = (message: string) => {
  const encodedMessage = encodeURIComponent(message);

  // اینجا از isMobileOS استفاده می‌کنیم تا گول سایزِ پنجره‌ی مرورگر در دسکتاپ را نخوریم
  if (isMobileOS()) {
    return `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;
  }

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
};