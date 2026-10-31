"use client";

import React, { useId, useState, useOptimistic } from "react";
import { useAdminTransition as useTransition } from "@/components/admin/ui/useAdminTransition";
import { Dices, Plus, Power, Tag, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import styles from "@/styles/admin/PromoCodes.module.css";
import {
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "@/app/actions/admin.actions";
import type { PromoCode } from "@/app/[locale]/dashboard/dashboard.types";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { useAdminRefresh } from "@/components/admin/ui/useAdminRefresh";
import { applyPromoCode } from "@/lib/pricing";

type AppliesTo = "both" | "buy_aud" | "sell_aud";
type FieldErrors = { code?: string; value?: string; uses?: string; perCustomer?: string; minAmount?: string };

const EMPTY_FORM = {
  code: "",
  applies_to: "both" as AppliesTo,
  discount_value: "",
  max_uses: "",
  per_customer_limit: "",
  min_amount_aud: "",
  expires_at: "",
  description: "",
};

const APPLIES_OPTIONS: { value: AppliesTo; label: string }[] = [
  { value: "both", label: "Buy & Sell" },
  { value: "buy_aud", label: "Buy AUD" },
  { value: "sell_aud", label: "Sell AUD" },
];
const SCOPE_BADGE: Record<AppliesTo, { label: string; className: string }> = {
  both: { label: "Buy & Sell", className: styles.scopeBoth },
  buy_aud: { label: "Buy AUD", className: styles.scopeBuy },
  sell_aud: { label: "Sell AUD", className: styles.scopeSell },
};
const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "No expiry", days: null },
];

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, so codes survive being read aloud
const generateCode = () => Array.from(crypto.getRandomValues(new Uint32Array(8)), n => CODE_CHARS[n % CODE_CHARS.length]).join("");

const pad = (n: number) => String(n).padStart(2, "0");
const isoInDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatNumber = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 2 });

function Segmented<T extends string>({ label, value, options, onChange, compact = false }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; compact?: boolean;
}) {
  return (
    <div className={`${styles.segmented} ${compact ? styles.segmentedCompact : ""}`} role="radiogroup" aria-label={label}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          className={styles.segment}
          data-value={option.value}
          onClick={() => onChange(option.value)}
          onKeyDown={event => {
            if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(event.key)) return;
            event.preventDefault();
            const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
            const index = options.findIndex(item => item.value === value);
            const next = options[(index + step + options.length) % options.length];
            onChange(next.value);
            event.currentTarget.parentElement?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The example is per 1 AUD, so the figure is exactly the discount value. */
const EXAMPLE_AUD = 1;
type Rates = { buy: number | null; sell: number | null };

/**
 * What customers get per trade, using the live published rates and the same
 * applyPromoCode() the quote engine uses, so the preview cannot drift from reality.
 * Terms are the company's (as in Transactions and the Ledger):
 *   Buy AUD  = we buy AUD from the customer, who is paid at our (lower) buy rate.
 *   Sell AUD = we sell AUD to the customer, who pays at our (higher) sell rate.
 */
function outcomes(form: typeof EMPTY_FORM, rates: Rates) {
  const value = parseFloat(form.discount_value);
  if (!Number.isFinite(value) || value <= 0) return [];
  const promo = { code: "PREVIEW", discount_type: "fixed" as const, discount_value: value, max_uses: null, used_count: 0, active: true, expires_at: null };
  const rateText = (n: number) => n.toLocaleString("en-AU", { maximumFractionDigits: 2 });
  const lines: { key: string; icon: React.ReactNode; title: string; text: string; delta: string }[] = [];

  const build = (trade: "buy_aud" | "sell_aud", baseRate: number | null) => {
    const weBuy = trade === "buy_aud";
    const title = weBuy ? "Buy AUD" : "Sell AUD";
    const note = weBuy ? "customer sells AUD" : "customer buys AUD";
    const icon = weBuy ? <TrendingUp size={16} /> : <TrendingDown size={16} />;
    // applyPromoCode takes the customer's request type, which is the opposite of ours.
    const result = baseRate && baseRate > 0 ? applyPromoCode(EXAMPLE_AUD, baseRate, weBuy ? "sell_aud" : "buy_aud", promo) : null;
    if (!baseRate || !result || !result.valid) {
      const benefit = `${formatNumber(value)} Toman better per AUD`;
      lines.push({ key: trade, icon, title: `${title} · ${note}`, text: `Customer ${weBuy ? "receives more" : "pays fewer"} Toman: ${benefit}.`, delta: "" });
      return;
    }
    const before = baseRate * EXAMPLE_AUD;
    const after = result.effectiveRate * EXAMPLE_AUD;
    lines.push({
      key: trade, icon, title: `${title} · ${note}`,
      text: `${rateText(baseRate)} → ${rateText(result.effectiveRate)} Toman per AUD`,
      delta: `${weBuy ? "+" : "−"}${formatNumber(Math.round(Math.abs(after - before)))} Toman`,
    });
  };
  if (form.applies_to !== "sell_aud") build("buy_aud", rates.buy);
  if (form.applies_to !== "buy_aud") build("sell_aud", rates.sell);
  return lines;
}

function statusOf(code: PromoCode) {
  if (!code.active) return { label: "Disabled", className: styles.badge };
  if (code.expires_at && new Date(code.expires_at) <= new Date()) return { label: "Expired", className: `${styles.badge} ${styles.badgeWarn}` };
  if (code.max_uses !== null && code.used_count >= code.max_uses) return { label: "Used up", className: `${styles.badge} ${styles.badgeWarn}` };
  return { label: "Active", className: `${styles.badge} ${styles.badgeActive}` };
}

export function PromoCodeManager({ initialCodes, rates }: { initialCodes: PromoCode[]; rates: Rates }) {
  const refreshAdmin = useAdminRefresh();
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
  const formId = useId();

  const [codes, setCodesOptimistic] = useOptimistic(initialCodes);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const activeCount = codes.filter(code => statusOf(code).label === "Active").length;
  const clearError = (key: keyof FieldErrors) => setErrors(current => ({ ...current, [key]: undefined }));
  const closeForm = () => { setShowForm(false); setFormError(""); setErrors({}); setForm(EMPTY_FORM); };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const value = parseFloat(form.discount_value);
    const next: FieldErrors = {};
    if (!/^[A-Z0-9_-]{3,50}$/.test(code)) next.code = "Use 3–50 characters: letters, numbers, - or _.";
    if (!Number.isFinite(value) || value <= 0) next.value = "Enter a value greater than zero.";
    else if (!Number.isInteger(value)) next.value = "Toman amounts must be whole numbers.";
    if (form.max_uses && Number(form.max_uses) < 1) next.uses = "Must be at least 1.";
    if (form.per_customer_limit && Number(form.per_customer_limit) < 1) next.perCustomer = "Must be at least 1.";
    if (form.min_amount_aud && !(Number(form.min_amount_aud) > 0)) next.minAmount = "Must be greater than zero.";
    if (form.per_customer_limit && form.max_uses && Number(form.per_customer_limit) > Number(form.max_uses)) next.perCustomer = "Cannot exceed the total uses.";
    setErrors(next);
    setFormError("");
    const firstInvalid = next.code ? "code" : next.value ? "value" : next.uses ? "uses" : next.perCustomer ? "percustomer" : next.minAmount ? "minamount" : null;
    if (firstInvalid) { document.getElementById(`${formId}-${firstInvalid}`)?.focus(); return; }

    startTransition(async () => {
      const result = await createPromoCode({
        code,
        discount_value: value,
        applies_to: form.applies_to,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : null,
        per_customer_limit: form.per_customer_limit ? parseInt(form.per_customer_limit, 10) : null,
        min_amount_aud: form.min_amount_aud ? parseFloat(form.min_amount_aud) : null,
        expires_at: form.expires_at || null,
        description: form.description || null,
        active: true,
      });
      if (result.error) {
        setFormError(result.error);
        showToast({ type: "error", message: result.error });
      } else {
        showToast({ type: "success", message: `Promo code "${code}" created.` });
        closeForm();
        refreshAdmin();
      }
    });
  };

  const handleToggle = (code: PromoCode) => {
    const next = !code.active;
    startTransition(async () => {
      setCodesOptimistic(prev => prev.map(item => (item.id === code.id ? { ...item, active: next } : item)));
      const result = await updatePromoCode(code.id, { active: next });
      if (result.error) showToast({ type: "error", message: result.error });
      else refreshAdmin();
    });
  };

  const handleDelete = (code: PromoCode) => {
    confirm({
      title: "Delete promo code",
      message: `Delete "${code.code}"? Customers with an open quote using it can no longer accept that quote. This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        const result = await deletePromoCode(code.id);
        if (result.error) showToast({ type: "error", message: result.error });
        else {
          showToast({ type: "success", message: `"${code.code}" deleted.` });
          refreshAdmin();
        }
      },
    });
  };

  const outcomeLines = outcomes(form, rates);

  return (
    <div className={styles.root}>
      <AdminConfirmDialog {...dialogProps} />
      <AdminToast {...toastProps} />

      <div className={styles.toolbar}>
        <span className={styles.summary}>
          <strong>{codes.length}</strong> {codes.length === 1 ? "code" : "codes"} · <strong>{activeCount}</strong> active
        </span>
        <button
          type="button"
          className={`${styles.btn} ${showForm ? "" : styles.btnPrimary}`}
          aria-expanded={showForm}
          aria-controls={formId}
          onClick={() => (showForm ? closeForm() : setShowForm(true))}
        >
          {showForm ? <X /> : <Plus />}
          {showForm ? "Close" : "New promo code"}
        </button>
      </div>

      {showForm && (
        <form id={formId} className={styles.card} onSubmit={handleCreate} noValidate>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}><Tag size={16} /> New promo code</h3>
          </div>

          <div className={styles.form}>
            <section className={styles.section} aria-labelledby={`${formId}-s1`}>
              <h4 className={styles.sectionTitle} id={`${formId}-s1`}>Code &amp; audience</h4>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor={`${formId}-code`}>Code</label>
                    <button type="button" className={styles.linkBtn} onClick={() => { setForm({ ...form, code: generateCode() }); clearError("code"); }}>
                      <Dices size={14} /> Generate
                    </button>
                  </div>
                  <input
                    id={`${formId}-code`}
                    type="text"
                    className={`${styles.input} ${styles.code}`}
                    placeholder="SUMMER20"
                    maxLength={50}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={`${formId}-code-msg`}
                    value={form.code}
                    onChange={event => { setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") }); clearError("code"); }}
                  />
                  <p className={errors.code ? styles.fieldError : styles.hint} id={`${formId}-code-msg`}>{errors.code ?? "What customers type at checkout."}</p>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Applies to</span>
                  <Segmented label="Applies to" value={form.applies_to} options={APPLIES_OPTIONS} onChange={value => setForm({ ...form, applies_to: value })} />
                  <p className={styles.hint}>
                    {form.applies_to === "both" ? "Buy = customer sells AUD to us. Sell = customer buys AUD from us." : form.applies_to === "buy_aud" ? "Only when we buy AUD: the customer sends AUD and is paid Toman at our buy rate." : "Only when we sell AUD: the customer pays Toman at our sell rate and receives AUD."}
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-labelledby={`${formId}-s2`}>
              <h4 className={styles.sectionTitle} id={`${formId}-s2`}>Discount</h4>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${formId}-value`}>Improves the rate by</label>
                  <div className={styles.amount}>
                    <input
                      id={`${formId}-value`}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className={styles.input}
                      placeholder="200"
                      aria-invalid={Boolean(errors.value)}
                      aria-describedby={`${formId}-value-msg`}
                      value={form.discount_value}
                      onChange={event => {
                        const next = event.target.value;
                        if (!/^\d{0,9}$/.test(next)) return;
                        setForm({ ...form, discount_value: next });
                        clearError("value");
                      }}
                    />
                    <span className={styles.unitStatic}>Toman / AUD</span>
                  </div>
                  <p className={errors.value ? styles.fieldError : styles.hint} id={`${formId}-value-msg`}>
                    {errors.value ?? "Toman added to (or taken off) the rate, per 1 AUD."}
                  </p>
                </div>
                <div className={styles.field}>
                  <span className={styles.label}>Customer outcome</span>
                  <div className={styles.outcome} role="status">
                    {outcomeLines.length === 0
                      ? <p className={styles.hint}>Enter a value to see what customers get.</p>
                      : outcomeLines.map(line => (
                        <div className={styles.outcomeLine} key={line.key}>
                          <span className={styles.outcomeIcon}>{line.icon}</span>
                          <span><strong>{line.title}{line.delta && <em>{line.delta}</em>}</strong>{line.text}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.section} aria-labelledby={`${formId}-s3`}>
              <h4 className={styles.sectionTitle} id={`${formId}-s3`}>Limits <small>(all optional)</small></h4>
              <div className={`${styles.grid} ${styles.grid3}`}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${formId}-uses`}>Total uses</label>
                  <input
                    id={`${formId}-uses`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={styles.input}
                    placeholder="Unlimited"
                    aria-invalid={Boolean(errors.uses)}
                    aria-describedby={`${formId}-uses-msg`}
                    value={form.max_uses}
                    onChange={event => { if (/^\d{0,7}$/.test(event.target.value)) { setForm({ ...form, max_uses: event.target.value }); clearError("uses"); } }}
                  />
                  <p className={errors.uses ? styles.fieldError : styles.hint} id={`${formId}-uses-msg`}>{errors.uses ?? "Across all customers."}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${formId}-percustomer`}>Uses per customer</label>
                  <input
                    id={`${formId}-percustomer`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={styles.input}
                    placeholder="Unlimited"
                    aria-invalid={Boolean(errors.perCustomer)}
                    aria-describedby={`${formId}-percustomer-msg`}
                    value={form.per_customer_limit}
                    onChange={event => { if (/^\d{0,4}$/.test(event.target.value)) { setForm({ ...form, per_customer_limit: event.target.value }); clearError("perCustomer"); } }}
                  />
                  <p className={errors.perCustomer ? styles.fieldError : styles.hint} id={`${formId}-percustomer-msg`}>{errors.perCustomer ?? "Use 1 for a one-time code."}</p>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${formId}-minamount`}>Minimum amount</label>
                  <div className={styles.amount}>
                    <input
                      id={`${formId}-minamount`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className={styles.input}
                      placeholder="None"
                      aria-invalid={Boolean(errors.minAmount)}
                      aria-describedby={`${formId}-minamount-msg`}
                      value={form.min_amount_aud}
                      onChange={event => { if (/^\d{0,7}(\.\d{0,2})?$/.test(event.target.value)) { setForm({ ...form, min_amount_aud: event.target.value }); clearError("minAmount"); } }}
                    />
                    <span className={styles.unitStatic}>AUD</span>
                  </div>
                  <p className={errors.minAmount ? styles.fieldError : styles.hint} id={`${formId}-minamount-msg`}>{errors.minAmount ?? "Smallest transfer the code accepts."}</p>
                </div>
              </div>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <span className={styles.label}>Valid until</span>
                  <div className={styles.datePicker}>
                    <CustomDatePicker value={form.expires_at} onChange={value => setForm({ ...form, expires_at: value })} placeholder="No expiry" />
                  </div>
                  <div className={styles.chips} role="group" aria-label="Quick expiry">
                    {EXPIRY_PRESETS.map(preset => {
                      const value = preset.days === null ? "" : isoInDays(preset.days);
                      return (
                        <button key={preset.label} type="button" className={styles.chip} aria-pressed={form.expires_at === value} onClick={() => setForm({ ...form, expires_at: value })}>
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor={`${formId}-note`}>Internal note</label>
                  <input
                    id={`${formId}-note`}
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Summer campaign"
                    maxLength={200}
                    value={form.description}
                    onChange={event => setForm({ ...form, description: event.target.value })}
                  />
                  <p className={styles.hint}>Only visible to admins.</p>
                </div>
              </div>
            </section>

            {formError && <p className={styles.error} role="alert">{formError}</p>}
          </div>

          <div className={styles.formFooter}>
            <button type="button" className={styles.btn} onClick={closeForm} disabled={isPending}>Cancel</button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={isPending}>
              {isPending ? "Creating…" : "Create code"}
            </button>
          </div>
        </form>
      )}

      {codes.length === 0 ? (
        <div className={styles.empty}>
          <Tag size={28} aria-hidden="true" />
          <p>No promo codes yet.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Applies to</th>
                <th scope="col">Discount</th>
                <th scope="col">Uses</th>
                <th scope="col">Valid until</th>
                <th scope="col">Status</th>
                <th scope="col"><span className={styles.srOnly}>Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {codes.map(code => {
                const status = statusOf(code);
                const scope = SCOPE_BADGE[code.applies_to ?? "both"] ?? SCOPE_BADGE.both;
                return (
                  <tr key={code.id}>
                    <td className={styles.codeCell} data-label="Code" data-span>
                      <strong>{code.code}</strong>
                      {code.description && <span>{code.description}</span>}
                    </td>
                    <td data-label="Applies to"><span className={scope.className}>{scope.label}</span></td>
                    <td className={styles.num} data-label="Discount">
                      {`${formatNumber(Number(code.discount_value))} Toman / AUD`}
                      {(code.min_amount_aud || code.per_customer_limit) && (
                        <span className={styles.subLine}>
                          {[code.min_amount_aud ? `Min ${formatNumber(Number(code.min_amount_aud))} AUD` : "", code.per_customer_limit ? `${code.per_customer_limit} per customer` : ""].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className={styles.num} data-label="Uses">{code.used_count}{code.max_uses ? ` / ${code.max_uses}` : " / ∞"}</td>
                    <td className={styles.num} data-label="Valid until">
                      {code.expires_at ? new Date(code.expires_at).toLocaleDateString("en-AU", { timeZone: "Australia/Melbourne" }) : "No expiry"}
                    </td>
                    <td data-label="Status"><span className={status.className}>{status.label}</span></td>
                    <td data-label="Actions" data-span>
                      <div className={styles.actions}>
                        <button type="button" className={styles.btn} onClick={() => handleToggle(code)} disabled={isPending}>
                          <Power />{code.active ? "Disable" : "Enable"}
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(code)} disabled={isPending} aria-label={`Delete ${code.code}`}>
                          <Trash2 />Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
