import { createClient } from '@supabase/supabase-js';

// سیستم به صورت هوشمند و خودکار، کلید عمومی (ANON_KEY) را از فایل .env.local برمی‌دارد
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; 

export const supabase = createClient(supabaseUrl, supabaseKey);