import { createClient } from '@supabase/supabase-js';

// گرفتن کلیدها از فایل .env.local که ساختید
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ساخت و اکسپورت کردن کلاینت سوپابیس برای استفاده در کل پروژه
export const supabase = createClient(supabaseUrl, supabaseKey);