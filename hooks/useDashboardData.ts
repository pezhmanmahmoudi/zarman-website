import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Profile, Transaction } from "@/app/fa/dashboard/dashboard.types";

export function useDashboardData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    const initializeDashboard = async () => {
      setLoading(true);
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      setSessionChecked(true);

      if (authError || !session) {
        router.replace("/fa/login");
        return;
      }

      const userId = session.user.id;
      const [profileRes, txRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (txRes.data) {
        const txData = txRes.data as Transaction[];
        setTransactions(txData);
        setTotalVolume(txData.reduce((acc, tx) => acc + Number(tx.amount_aud || 0), 0));
      }
      setLoading(false);
    };

    initializeDashboard();
  }, [router]);

  return { profile, transactions, totalVolume, loading, sessionChecked };
}