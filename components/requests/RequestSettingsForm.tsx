"use client";

import { useEffect, useState } from "react";
import { getRequestSettings, saveRequestSettings } from "@/app/actions/request.actions";
import type { RequestSettings, SettingsRecord } from "@/lib/requests/types";
import styles from "@/styles/requests/Requests.module.css";

export function RequestSettingsForm() {
  const [record, setRecord] = useState<SettingsRecord | null>(null);
  const [emails, setEmails] = useState("");
  const [holidays, setHolidays] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getRequestSettings().then(result => {
      if (result.error) setError(result.error);
      else if (result.data) { setRecord(result.data); setEmails(result.data.settings.management_emails.join("\n")); setHolidays(result.data.settings.holidays.join("\n")); }
    }).catch(() => setError("Could not load request service settings."))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof RequestSettings>(key: K, value: RequestSettings[K]) {
    setRecord(current => current ? { ...current, settings: { ...current.settings, [key]: value } } : null);
    setMessage("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveRequestSettings({ expectedVersion: record.version, settings: { ...record.settings, management_emails: emails.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean), holidays: holidays.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean) } });
      if (result.error) setError(result.error);
      else if (result.data) { setRecord(result.data); setMessage("Service settings saved. New quotes use this version; accepted quotes retain their original terms."); }
    } catch { setError("Could not save settings. Check your connection and retry."); }
    finally { setSaving(false); }
  }

  const settings = record?.settings;
  const numbers: Array<{ key: "priority_fee_aud" | "priority_capacity" | "standard_minutes" | "priority_minutes" | "quote_minutes" | "funding_minutes" | "max_amount_aud" | "opening_hour" | "closing_hour"; label: string; min: number; max?: number; step?: number }> = [
    { key: "priority_fee_aud", label: "Additional priority fee (AUD)", min: 0, step: .01 },
    { key: "priority_capacity", label: "Concurrent priority capacity", min: 1 },
    { key: "standard_minutes", label: "Standard handling target (business minutes)", min: 1 },
    { key: "priority_minutes", label: "Priority handling target (business minutes)", min: 1 },
    { key: "quote_minutes", label: "Quote validity (minutes)", min: 1 },
    { key: "funding_minutes", label: "Funding window (minutes)", min: 1 },
    { key: "max_amount_aud", label: "Maximum requested amount (AUD)", min: 1, step: .01 },
    { key: "opening_hour", label: "Opening hour (Sydney, 0–23)", min: 0, max: 23 },
    { key: "closing_hour", label: "Closing hour (Sydney, 1–24)", min: 1, max: 24 },
  ];

  return <details className={`${styles.card} ${styles.settings}`}>
    <summary>Service settings and management notifications</summary>
    <p className={styles.muted}>Configure commercial terms, bank instructions and management recipients before enabling submissions. Disabling new requests keeps existing tracking and processing available.</p>
    {loading && <p role="status">Loading settings…</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.notice} role="status">{message}</p>}
    {settings && <form onSubmit={submit}>
      <fieldset disabled={saving} style={{ border: 0, margin: 0, padding: 0 }}>
        <label className={styles.checkbox}><input type="checkbox" checked={settings.enabled} onChange={e => set("enabled", e.target.checked)} />Enable new online requests</label>
        <label className={styles.checkbox}><input type="checkbox" checked={settings.priority_enabled} onChange={e => set("priority_enabled", e.target.checked)} />Offer paid priority service</label>
        <div className={styles.fields}>
          {numbers.map(field => <label className={styles.field} key={field.key}>{field.label}<input type="number" required min={field.min} max={field.max} step={field.step || 1} value={settings[field.key]} onChange={e => set(field.key, e.target.valueAsNumber)} /></label>)}
          <div className={`${styles.field} ${styles.full}`}><span>Business days (Australia/Sydney)</span><div className={styles.actions}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <label className={styles.checkbox} key={day}><input type="checkbox" checked={settings.business_days.includes(index)} onChange={e => set("business_days", e.target.checked ? [...settings.business_days, index].sort() : settings.business_days.filter(value => value !== index))} />{day}</label>)}</div></div>
          <label className={styles.field}>Holidays (YYYY-MM-DD, one per line)<textarea value={holidays} onChange={e => setHolidays(e.target.value)} placeholder="2026-12-25" /></label>
          <label className={styles.field}>Management email recipients (one per line)<textarea value={emails} onChange={e => setEmails(e.target.value)} placeholder="operations@example.com" /></label>
          <label className={styles.field}>AUD funding instructions<textarea value={settings.payment_instructions_aud} onChange={e => set("payment_instructions_aud", e.target.value)} placeholder="Approved account name, BSB, account number and transfer instructions" /></label>
          <label className={styles.field}>Toman funding instructions<textarea value={settings.payment_instructions_irt} onChange={e => set("payment_instructions_irt", e.target.value)} placeholder="Approved beneficiary, bank account or IBAN, explicitly denominated in Toman" /></label>
          <label className={styles.field}>Priority terms, cancellation and refunds (English)<textarea value={settings.priority_terms} onChange={e => set("priority_terms", e.target.value)} /></label>
          <label className={styles.field}>Priority terms, cancellation and refunds (Persian)<textarea dir="rtl" lang="fa" value={settings.priority_terms_fa} onChange={e => set("priority_terms_fa", e.target.value)} /></label>
        </div>
        <p className={styles.muted}>Targets begin after required checks and confirmed funds. A priority fee is separate from the exchange amount. Bank settlement timing is separate from the handling target.</p>
        <button className={styles.button} type="submit">{saving ? "Saving…" : "Save service settings"}</button>
      </fieldset>
    </form>}
  </details>;
}
