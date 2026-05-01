"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Profile, Transaction } from "@/app/[locale]/dashboard/dashboard.types";

function getLocaleFromPath(pathname: string): "fa" | "en" {
  if (pathname.startsWith("/en")) return "en";
  return "fa";
}

export function useDashboardData() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const initializeDashboard = async () => {
      const locale = getLocaleFromPath(pathname);

      try {
        setLoading(true);
        
        const {
          data: { session },
          error: authError,
        } = await supabase.auth.getSession();

        if (authError || !session) {
          router.replace(`/${locale}/login`);
          return;
        }

        const userId = session.user.id;
        // 🚀 اجرای همزمان درخواست‌ها برای سرعت بیشتر
        const [profileRes, txRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
           supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (txRes.error) throw txRes.error;

        if (!isMounted) return;

        if (profileRes.data) setProfile(profileRes.data as Profile);
        
        if (txRes.data) {
          const txData = txRes.data as Transaction[];
          setTransactions(txData);
          setTotalVolume(txData.reduce((acc, tx) => acc + Number(tx.amount_aud || 0), 0));
        }
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
       if (!isMounted) return;
        setSessionChecked(true);
        setLoading(false);
      }
    };

    initializeDashboard();
    
    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  return { profile, transactions, totalVolume, loading, sessionChecked };
}