// isMobile.ts
export function isMobile() {
  if (typeof window === "undefined") return false;

  // 1. Device Type Check
  const isDevice = /iPhone|iPad|iPod|Android/i.test(
    navigator.userAgent || ""
  );

  // 2. Dimension Check (The "iPad Pro" Fix)
  // 1024px is a common cutoff. If you want iPad Pro to follow 
  // the Desktop version, set this to 1023. 
  // If you want it to stay on Mobile, set it to 1025+.
  const isSmallScreen = window.innerWidth <= 1024;

  return isDevice || isSmallScreen;
}