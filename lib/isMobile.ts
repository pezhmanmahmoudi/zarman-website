export function isMobile() {
  if (typeof window === "undefined") return false;

  // 1. Device Type Check
  const isDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || "");

  // 2. Dimension Check
  const isSmallScreen = window.innerWidth <= 1024;

  return isDevice || isSmallScreen;
}

// 👈 تابع جدید: فقط و فقط برای تشخیص سخت‌افزار واقعی (بدون توجه به سایز مرورگر)
export function isMobileOS() {
  if (typeof window === "undefined") return false;
  
  const userAgent = navigator.userAgent || "";
  const isDevice = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isTouchDevice = navigator.maxTouchPoints && navigator.maxTouchPoints > 2;

  return isDevice || isTouchDevice;
}