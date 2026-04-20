export function useDashboardData() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalVolume, setTotalVolume] = useState(0);

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        setLoading(true);
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        setSessionChecked(true);

        if (authError || !session) {
          router.replace("/fa/login"); // 🚀 مسیر کاملاً درست است
          return;
        }

        const userId = session.user.id;
        // 🚀 اجرای همزمان درخواست‌ها برای سرعت بیشتر
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
      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        // 🚀 این خط تضمین می‌کند که در هر صورت (موفقیت یا شکست) حالت لودینگ تمام شود
        setLoading(false);
      }
    };

    initializeDashboard();
  }, [router]);

  return { profile, transactions, totalVolume, loading, sessionChecked };
}