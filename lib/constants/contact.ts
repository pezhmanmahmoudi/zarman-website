export const WHATSAPP_NUMBER = "61497851631";

export const WHATSAPP_MESSAGE_TRANSFER_HELP =
  "سلام، من از طریق وب‌سایت زرمان پیام می‌دهم و برای انتقال وجه نیاز به راهنمایی دارم.";
export const WHATSAPP_MESSAGE_SIGNUP_HELP =
  "سلام. وقت بخیر. من برای ثبت‌نام و انجام تراکنش در صرافی زرمان نیاز به راهنمایی دارم.";

export const buildWhatsAppUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
