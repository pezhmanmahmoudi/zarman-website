"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTreasurySettings, type TreasurySettingsRow } from "@/app/actions/treasury.actions";
import s from "@/styles/admin/Treasury.module.css";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";

type Props = {
  settings: TreasurySettingsRow;
};

export default function TreasurySettingsForm({ settings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [form, setForm] = useState({
    minAud: String(settings.min_aud_inventory),
    targetAud: String(settings.target_aud_inventory),
    maxAud: String(settings.max_aud_inventory),
    minLiquidity: String(settings.min_irt_liquidity),
    maxExposurePct: String((settings.max_aud_exposure * 100).toFixed(2)),
    targetExposurePct: String((settings.target_exposure_ratio * 100).toFixed(2)),
    coverageDays: String(settings.inventory_coverage_target_days),
    runwayMonths: String(settings.cash_runway_target_months),
    sensitivity: settings.recommendation_sensitivity,
  });

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setOk(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const minAud = Number(form.minAud.replace(/,/g, ""));
    const targetAud = Number(form.targetAud.replace(/,/g, ""));
    const maxAud = Number(form.maxAud.replace(/,/g, ""));
    const minLiquidity = Number(form.minLiquidity.replace(/,/g, ""));
    const maxExposure = Number(form.maxExposurePct.replace(/,/g, "")) / 100;
    const targetExposure = Number(form.targetExposurePct.replace(/,/g, "")) / 100;
    const coverageDays = Number(form.coverageDays.replace(/,/g, ""));
    const runwayMonths = Number(form.runwayMonths.replace(/,/g, ""));

    if (![minAud, targetAud, maxAud, minLiquidity, maxExposure, targetExposure, coverageDays, runwayMonths].every(Number.isFinite)) {
      setError("همه فیلدهای تنظیمات باید عدد معتبر باشند.");
      return;
    }

    startTransition(async () => {
      const result = await updateTreasurySettings({
        min_aud_inventory: minAud,
        target_aud_inventory: targetAud,
        max_aud_inventory: maxAud,
        min_irt_liquidity: minLiquidity,
        max_aud_exposure: maxExposure,
        target_exposure_ratio: targetExposure,
        inventory_coverage_target_days: coverageDays,
        cash_runway_target_months: runwayMonths,
        recommendation_sensitivity: form.sensitivity,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setOk(true);
      router.refresh();
    });
  }

  return (
    <form className={s.compactForm} onSubmit={handleSubmit}>
      <div className={s.formRow}>
        <div className={s.formGroup}>
          <label className={s.formLabel}>حداقل موجودی دلار</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.minAud} onChange={(e) => setField("minAud", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>هدف موجودی دلار</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.targetAud} onChange={(e) => setField("targetAud", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>حداکثر موجودی دلار</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.maxAud} onChange={(e) => setField("maxAud", e.target.value)} disabled={isPending} />
        </div>
      </div>

      <div className={s.formRow}>
        <div className={s.formGroup}>
          <label className={s.formLabel}>حداقل نقدینگی ایران (تومان)</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.minLiquidity} onChange={(e) => setField("minLiquidity", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>هدف مواجهه (%)</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.targetExposurePct} onChange={(e) => setField("targetExposurePct", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>حداکثر مواجهه (%)</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.maxExposurePct} onChange={(e) => setField("maxExposurePct", e.target.value)} disabled={isPending} />
        </div>
      </div>

      <div className={s.formRow}>
        <div className={s.formGroup}>
          <label className={s.formLabel}>هدف پوشش موجودی (روز)</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.coverageDays} onChange={(e) => setField("coverageDays", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>هدف Runway (ماه)</label>
          <input className={`${s.formInput} ${s.formInputNum}`} value={form.runwayMonths} onChange={(e) => setField("runwayMonths", e.target.value)} disabled={isPending} />
        </div>
        <div className={s.formGroup}>
          <label className={s.formLabel}>حساسیت توصیه</label>
          <SelectBox
            className={s.formSelect}
            labeledOptions={[
              { value: "low", label: "کم" },
              { value: "medium", label: "متوسط" },
              { value: "high", label: "زیاد" },
            ]}
            value={form.sensitivity}
            onChange={(val) => setField("sensitivity", val)}
            disabled={isPending}
          />
        </div>
      </div>

      <div className={s.formActionsRow}>
        <button className={s.btnSubmit} type="submit" disabled={isPending}>
          {isPending ? "در حال ذخیره..." : "ذخیره تنظیمات خزانه"}
        </button>
      </div>

      {error && <p className={s.formError}>{error}</p>}
      {ok && <p style={{ fontSize: "0.8rem", color: "#059669", marginTop: "0.375rem" }}>✓ تنظیمات با موفقیت ذخیره شد.</p>}
    </form>
  );
}
