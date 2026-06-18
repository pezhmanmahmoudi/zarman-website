"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAccountBalances } from "@/app/actions/treasury.actions";
import s from "@/styles/admin/Treasury.module.css";

type Props = {
  initialKadoos: number;
  initialPezhman: number;
};

export default function AccountBalanceForm({ initialKadoos, initialPezhman }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kadoos,  setKadoos]  = useState(String(initialKadoos));
  const [pezhman, setPezhman] = useState(String(initialPezhman));
  const [error,   setError]   = useState<string | null>(null);
  const [ok,      setOk]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const k = Number(kadoos.replace(/,/g, ""));
    const p = Number(pezhman.replace(/,/g, ""));

    if (!Number.isFinite(k) || k < 0) { setError("موجودی کادوس نامعتبر است."); return; }
    if (!Number.isFinite(p) || p < 0) { setError("موجودی پژمان نامعتبر است."); return; }

    startTransition(async () => {
      const res = await updateAccountBalances(k, p);
      if ("error" in res) {
        setError(res.error);
      } else {
        setOk(true);
        router.refresh();
      }
    });
  }

  return (
    <div className={s.balanceUpdatePanel}>
      <div className={s.balanceUpdateTitle}>
        <span>🔄</span>
        <span>به‌روزرسانی موجودی حساب‌های ایران</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className={s.formRow}>
          <div className={s.formGroup}>
            <label className={s.formLabel}>موجودی کادوس (تومان)</label>
            <input
              className={`${s.formInput} ${s.formInputNum}`}
              type="text"
              inputMode="numeric"
              value={kadoos}
              onChange={e => { setKadoos(e.target.value); setOk(false); }}
              placeholder="0"
              disabled={isPending}
            />
          </div>
          <div className={s.formGroup}>
            <label className={s.formLabel}>موجودی پژمان (تومان)</label>
            <input
              className={`${s.formInput} ${s.formInputNum}`}
              type="text"
              inputMode="numeric"
              value={pezhman}
              onChange={e => { setPezhman(e.target.value); setOk(false); }}
              placeholder="0"
              disabled={isPending}
            />
          </div>
          <div className={s.formGroup} style={{ flexGrow: 0, minWidth: "auto" }}>
            <label className={s.formLabel}>&nbsp;</label>
            <button className={s.btnSubmit} type="submit" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : "ذخیره موجودی"}
            </button>
          </div>
        </div>
        {error && <p className={s.formError}>{error}</p>}
        {ok    && <p style={{ fontSize: "0.775rem", color: "#059669", marginTop: "0.375rem", direction: "rtl" }}>✓ موجودی با موفقیت به‌روز شد.</p>}
      </form>
    </div>
  );
}
