export type NavItem = { label: string; href: string };

const navAnchors = ['#hero', '#rates', '#about', '#services', '#how-it-works', '#contact'] as const;

const faLabels = ['خانه', 'محاسبه‌گر', 'درباره زرمان', 'خدمات زرمان', 'نحوه انتقال', 'تماس با ما'];
const enLabels = ['Home', 'Calculator', 'About', 'Services', 'How It Works', 'Contact'];

export function getPublicNavItems(locale: 'fa' | 'en'): NavItem[] {
  const labels = locale === 'en' ? enLabels : faLabels;
  return navAnchors.map((href, i) => ({ label: labels[i], href }));
}

// Legacy default export — Persian, for components that haven't been migrated yet
export const publicNavItems: NavItem[] = getPublicNavItems('fa');
export const navigation = publicNavItems;