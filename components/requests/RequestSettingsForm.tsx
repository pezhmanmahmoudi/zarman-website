"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Save, SlidersHorizontal } from "lucide-react";
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
  const [dirty, setDirty] = useState(false);

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
    setDirty(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveRequestSettings({ expectedVersion: record.version, settings: { ...record.settings, management_emails: emails.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean), holidays: holidays.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean) } });
      if (result.error) setError(result.error);
      else if (result.data) {
        setRecord(result.data);
        setEmails(result.data.settings.management_emails.join("\n"));
        setHolidays(result.data.settings.holidays.join("\n"));
        setDirty(false);
        setMessage("Service settings saved. Accepted requests keep their original terms.");
      }
    } catch { setError("Could not save settings. Check your connection and retry."); }
    finally { setSaving(false); }
  }

  const settings = record?.settings;
  const numbers: Array<{ key: "priority_fee_aud" | "priority_capacity" | "standard_minutes" | "priority_minutes" | "quote_minutes" | "funding_minutes" | "australian_clearance_minutes" | "max_amount_aud" | "opening_hour" | "closing_hour"; label: string; min: number; max?: number; step?: number }> = [
    { key: "priority_fee_aud", label: "Additional priority fee (AUD)", min: 0, max: 1000, step: .01 },
    { key: "priority_capacity", label: "Concurrent priority capacity (0 disables availability)", min: 0, max: 100 },
    { key: "standard_minutes", label: "Standard handling target (business minutes)", min: 1, max: 10080 },
    { key: "priority_minutes", label: "Priority handling target (business minutes)", min: 1, max: 10080 },
    { key: "quote_minutes", label: "Quote validity (minutes)", min: 1, max: 60 },
    { key: "funding_minutes", label: "Customer payment initiation window (minutes)", min: 1, max: 10080 },
    { key: "australian_clearance_minutes", label: "Australian bank clearance buffer (minutes; 1440 = 24 hours)", min: 1440, max: 10080 },
    { key: "max_amount_aud", label: "Maximum requested amount (AUD)", min: 1, max: 1000000, step: .01 },
    { key: "opening_hour", label: "Opening hour (Sydney, 0–23)", min: 0, max: 23 },
    { key: "closing_hour", label: "Closing hour (Sydney, 1–24)", min: 1, max: 24 },
  ];

  function numberField(key: typeof numbers[number]["key"], hint?: string) {
    const field = numbers.find(field => field.key === key)!;
    return <label className={styles.field} key={key}>{field.label}
      <input type="number" required min={field.min} max={field.max} step={field.step || 1} value={Number.isNaN(settings![key]) ? "" : settings![key]} onChange={event => set(key, event.target.valueAsNumber)} />
      {hint && <small className={styles.settingsHelp}>{hint}</small>}
    </label>;
  }

  return <details className={`${styles.card} ${styles.settings}`}>
    <summary className={styles.settingsSummary}>
      <SlidersHorizontal size={21} aria-hidden="true" />
      <span className={styles.settingsSummaryText}><strong>Service settings and management notifications</strong><small>Pricing, bank details, working hours and email recipients</small></span>
      {settings && <span className={`${styles.badge} ${settings.enabled ? styles.success : ""}`}>{settings.enabled ? "Requests enabled" : "Requests paused"}</span>}
      <ChevronDown className={styles.settingsChevron} size={20} aria-hidden="true" />
    </summary>
    <div className={styles.settingsIntro}>
      <p className={styles.muted}>Set up your service before accepting requests. Pausing new submissions keeps existing tracking and processing available.</p>
      {settings && <nav className={styles.settingsNav} aria-label="Service settings sections">
        <a href="#request-service">Service & pricing</a><a href="#request-notifications">Notifications</a><a href="#request-bank-details">Bank details</a><a href="#request-timing">Timing & calendar</a><a href="#request-terms">Priority terms</a>
      </nav>}
      {loading && <p role="status">Loading settings…</p>}
      {!settings && error && <p className={styles.error} role="alert">{error}</p>}
    </div>
    {settings && <form onSubmit={submit}>
      <div className={styles.settingsSaveBar}>
        <div className={styles.settingsSaveRow}>
          <div className={styles.settingsSaveState} role="status"><strong>{saving ? "Saving your changes…" : dirty ? "Unsaved changes" : "Settings are up to date"}</strong><span>Changes apply to new requests.</span></div>
          <button className={styles.button} type="submit" disabled={saving || !dirty}><Save size={16} aria-hidden="true" />{saving ? "Saving…" : "Save service settings"}</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.notice} role="status">{message}</p>}
      </div>
      <fieldset disabled={saving} className={styles.settingsFields}>
        <section id="request-service" className={styles.settingsSection} aria-labelledby="request-service-title">
          <div className={styles.settingsSectionHeading}><span>01</span><div><h2 id="request-service-title">Service & pricing</h2><p>Control availability and the additional fee for Priority.</p></div></div>
          <div className={styles.fields}>
            <label className={styles.settingsToggle}><span><strong>Enable new online requests</strong><small>Customers can accept quotes and submit transfers.</small></span><input type="checkbox" checked={settings.enabled} onChange={event => set("enabled", event.target.checked)} /></label>
            <label className={styles.settingsToggle}><span><strong>Offer paid priority service</strong><small>Requires available capacity and agreed Priority terms.</small></span><input type="checkbox" checked={settings.priority_enabled} onChange={event => set("priority_enabled", event.target.checked)} /></label>
            {numberField("priority_fee_aud", "Added to the customer's funding total; recipient principal stays unchanged.")}
            {numberField("priority_capacity", "Maximum number of Priority requests accepted at the same time.")}
            {numberField("max_amount_aud")}
          </div>
        </section>
        <section id="request-notifications" className={styles.settingsSection} aria-labelledby="request-notifications-title">
          <div className={styles.settingsSectionHeading}><span>02</span><div><h2 id="request-notifications-title">Management notifications</h2><p>Keep your operations team informed automatically.</p></div></div>
          <div className={styles.fields}>
            <label className={styles.field}>Management email recipients (one per line)<textarea rows={4} spellCheck={false} autoCapitalize="none" value={emails} onChange={event => { setEmails(event.target.value); setDirty(true); setMessage(""); }} placeholder={"operations@example.com\nfinance@example.com"} aria-describedby="request-recipient-help" /><small id="request-recipient-help" className={styles.settingsHelp}>Add up to 10 team addresses. Commas and semicolons also work.</small></label>
            <div className={styles.settingsExplanation}><strong>Updates your team receives</strong><p>New requests, payment evidence, cleared funds, processing, completion and refunds. Final receipts are attached to completion emails.</p><p>Customers receive their own updates at their verified email address. Internal overdue alerts go to management.</p></div>
          </div>
        </section>
        <section id="request-bank-details" className={styles.settingsSection} aria-labelledby="request-bank-details-title">
          <div className={styles.settingsSectionHeading}><span>03</span><div><h2 id="request-bank-details-title">Bank details</h2><p>These instructions appear on the customer&apos;s dashboard and in funding emails.</p></div></div>
          <div className={styles.fields}>
            <label className={styles.field}>AUD funding instructions<textarea rows={5} maxLength={4000} value={settings.payment_instructions_aud} onChange={event => set("payment_instructions_aud", event.target.value)} placeholder={"Account name:\nBSB:\nAccount number:"} /></label>
            <label className={styles.field}>Toman funding instructions<textarea rows={5} maxLength={4000} value={settings.payment_instructions_irt} onChange={event => set("payment_instructions_irt", event.target.value)} placeholder={"Beneficiary:\nBank:\nAccount / IBAN:\nAmounts are in Toman."} /></label>
          </div>
          <p className={styles.settingsHelp}>The website adds the customer&apos;s reference code and asks them to include it in their bank transfer description.</p>
        </section>
        <section id="request-timing" className={styles.settingsSection} aria-labelledby="request-timing-title">
          <div className={styles.settingsSectionHeading}><span>04</span><div><h2 id="request-timing-title">Timing & business calendar</h2><p>Handling targets start after cleared funds and required checks. All working hours use Australia/Sydney.</p></div></div>
          <div className={styles.fields}>
            {numberField("standard_minutes", "240 business minutes = 4 working hours.")}
            {numberField("priority_minutes", "Must be shorter than the Standard target.")}
            {numberField("quote_minutes")}
            {numberField("funding_minutes")}
            {numberField("australian_clearance_minutes", "At least 24 hours, separate from the payment initiation window.")}
            <div className={styles.full}><p className={styles.settingsHelp}>Customers must initiate payment within the funding window. Australian clearance gets an additional buffer, normally 24 hours; uploaded evidence or partial receipts require finance review if late.</p></div>
            {numberField("opening_hour")}{numberField("closing_hour")}
            <div className={`${styles.field} ${styles.full}`}><span>Business days (Australia/Sydney)</span><div className={styles.settingsDays}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <label key={day}><input type="checkbox" checked={settings.business_days.includes(index)} onChange={event => set("business_days", event.target.checked ? [...settings.business_days, index].sort() : settings.business_days.filter(value => value !== index))} />{day}</label>)}</div></div>
            <label className={styles.field}>Holidays (YYYY-MM-DD, one per line)<textarea value={holidays} onChange={event => { setHolidays(event.target.value); setDirty(true); setMessage(""); }} placeholder="2026-12-25" /></label>
            <label className={styles.field}>Iranian banking cycles and holidays advisory (English, shown to customers)<textarea required maxLength={2000} value={settings.iran_banking_notice} onChange={event => set("iran_banking_notice", event.target.value)} placeholder="Explain how Paya cycles, Satna operating hours and bank holidays affect settlement." /></label>
          </div>
        </section>
        <section id="request-terms" className={styles.settingsSection} aria-labelledby="request-terms-title">
          <div className={styles.settingsSectionHeading}><span>05</span><div><h2 id="request-terms-title">Priority terms</h2><p>Explain the handling target, cancellation and refund conditions in both languages.</p></div></div>
          <div className={styles.fields}>
            <label className={styles.field}>Priority terms, cancellation and refunds (English)<textarea rows={5} maxLength={4000} value={settings.priority_terms} onChange={event => set("priority_terms", event.target.value)} /></label>
            <label className={styles.field}>Priority terms, cancellation and refunds (Persian)<textarea rows={5} maxLength={4000} dir="rtl" lang="fa" value={settings.priority_terms_fa} onChange={event => set("priority_terms_fa", event.target.value)} /></label>
          </div>
        </section>
      </fieldset>
    </form>}
  </details>;
}
