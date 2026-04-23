import { redirect } from 'next/navigation';

export default function RootPage() {
  // انتقال هوشمند تمام ورودی‌های دامنه اصلی به بخش فارسی
  redirect('/fa');
}