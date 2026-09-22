"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Save, SlidersHorizontal } from "lucide-react";
import { getRequestSettings, saveRequestSettings } from "@/app/actions/request.actions";
import type { FundingBankDetails, RequestSettings, SettingsRecord } from "@/lib/requests/types";
import styles from "@/styles/requests/Requests.module.css";
import ui from "@/styles/requests/RequestSettings.module.css";

const sections = [
  ["service", "Service & pricing"], ["bank-details", "Bank details"],
  ["notifications", "Notifications"], ["timing", "Hours & timing"], ["terms", "Terms"],
] as const;
type Section = typeof sections[number][0];
type NumberKey = "priority_fee_aud" | "priority_capacity" | "standard_minutes" | "priority_minutes" | "quote_minutes" | "funding_minutes" | "australian_clearance_minutes" | "max_amount_aud" | "opening_hour" | "closing_hour";

export function RequestSettingsForm() {
  const [record, setRecord] = useState<SettingsRecord | null>(null);
  const [emails, setEmails] = useState("");
  const [holidays, setHolidays] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState<Section>("service");
  const [language, setLanguage] = useState<"en" | "fa">("en");
  const panel = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let alive = true;
    getRequestSettings().then(result => {
      if (!alive) return;
      if (result.error) setError(result.error);
      else if (result.data) {
        setRecord(result.data); setEmails(result.data.settings.management_emails.join("\n"));
        setHolidays(result.data.settings.holidays.join("\n"));
      }
    }).catch(() => { if (alive) setError("Could not load settings."); })
      .finally(() => { if (alive) setLoading(false); });
    const followHash = () => {
      const name = window.location.hash.replace("#request-", "") as Section;
      if (sections.some(([key]) => key === name)) {
        setActive(name);
        if (panel.current) panel.current.open = true;
      }
    };
    followHash(); window.addEventListener("hashchange", followHash);
    return () => { alive = false; window.removeEventListener("hashchange", followHash); };
  }, []);

  function set<K extends keyof RequestSettings>(key: K, value: RequestSettings[K]) {
    setRecord(current => current ? { ...current, settings: { ...current.settings, [key]: value } } : null);
    setDirty(true); setMessage("");
  }
  function bank(currency: "aud" | "irt", key: keyof FundingBankDetails, value: string) {
    const name = currency === "aud" ? "payment_details_aud" : "payment_details_irt";
    set(name, { ...(record?.settings[name] || {}), [key]: value });
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await saveRequestSettings({ expectedVersion: record.version, settings: {
        ...record.settings,
        management_emails: emails.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean),
        holidays: holidays.split(/[\n,;]+/).map(value => value.trim()).filter(Boolean),
      } });
      if (result.error) {
        setError(result.error);
        if (/BSB|account|IBAN|bank|Toman/i.test(result.error)) setActive("bank-details");
        else if (/management email/i.test(result.error)) setActive("notifications");
      } else if (result.data) {
        setRecord(result.data); setEmails(result.data.settings.management_emails.join("\n"));
        setHolidays(result.data.settings.holidays.join("\n")); setDirty(false); setMessage("Settings saved.");
      }
    } catch { setError("Could not save. Please retry."); }
    finally { setSaving(false); }
  }
  const settings = record?.settings;
  function number(key: NumberKey, label: string, min: number, max: number, step = 1) {
    return <label className={styles.field}>{label}<input type="number" min={min} max={max} step={step}
      value={Number.isNaN(settings![key]) ? "" : settings![key]} onChange={event => set(key, event.target.valueAsNumber)} /></label>;
  }
  function bankField(currency: "aud" | "irt", key: keyof FundingBankDetails, label: string, placeholder = "", numeric = false) {
    const details = settings?.[currency === "aud" ? "payment_details_aud" : "payment_details_irt"] || {};
    return <label className={styles.field}>{label}<input type="text" inputMode={numeric ? "numeric" : undefined}
      dir={numeric || key === "iban" ? "ltr" : undefined} maxLength={200} autoComplete="off"
      value={details[key] || ""} placeholder={placeholder} onChange={event => bank(currency, key, event.target.value)} /></label>;
  }
  const fa = language === "fa";
  return <details ref={panel} className={styles.card + " " + styles.settings}>
    <summary className={styles.settingsSummary}>
      <SlidersHorizontal size={20} aria-hidden="true" />
      <span className={styles.settingsSummaryText}><strong>Service settings</strong></span>
      {settings && <span className={styles.badge + (settings.enabled ? " " + styles.success : "")}>{settings.enabled ? "Open" : "Paused"}</span>}
      <ChevronDown className={styles.settingsChevron} size={18} aria-hidden="true" />
    </summary>
    {loading && <p className={ui.feedback} role="status">Loading settings…</p>}
    {!settings && error && <p className={styles.error} role="alert">{error}</p>}
    {settings && <form onSubmit={submit} noValidate>
      <div className={styles.settingsSaveBar}>
        <div className={styles.settingsSaveRow}>
          <div className={styles.settingsSaveState}><strong>{saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}</strong><span>Applies to new requests.</span></div>
          <button className={styles.button} type="submit" disabled={saving || !dirty}><Save size={16} />{saving ? "Saving…" : "Save settings"}</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {message && <p className={styles.notice} role="status">{message}</p>}
      </div>
      <nav className={ui.categories} aria-label="Service settings sections">
        {sections.map(([key, label]) => <button type="button" key={key} aria-pressed={active === key} aria-controls={"request-" + key} onClick={() => setActive(key)}>{label}</button>)}
      </nav>
      <fieldset disabled={saving} className={styles.settingsFields}>
        <section id="request-service" className={ui.section} hidden={active !== "service"} aria-label="Service and pricing">
          <div className={styles.fields}>
            <label className={styles.settingsToggle}><strong>Accept requests</strong><input type="checkbox" checked={settings.enabled} onChange={event => set("enabled", event.target.checked)} /></label>
            <label className={styles.settingsToggle}><strong>Offer Priority</strong><input type="checkbox" checked={settings.priority_enabled} onChange={event => set("priority_enabled", event.target.checked)} /></label>
            {number("priority_fee_aud", "Priority fee · AUD", 0, 1000, .01)}
            {number("priority_capacity", "Priority capacity", 0, 100)}
            {number("max_amount_aud", "Maximum transfer · AUD", 1, 1000000, .01)}
          </div>
        </section>
        <section id="request-bank-details" className={ui.section} hidden={active !== "bank-details"} aria-label="Bank details">
          <div className={ui.bankGrid}>
            <div className={ui.bank}><h3>AUD account</h3><div className={styles.fields}>
              {bankField("aud", "account_name", "Account name")}{bankField("aud", "bank_name", "Bank")}
              {bankField("aud", "bsb", "BSB", "123-456", true)}{bankField("aud", "account_number", "Account number", "", true)}
            </div></div>
            <div className={ui.bank}><h3>Toman account</h3><div className={styles.fields}>
              {bankField("irt", "account_name", "Account name")}{bankField("irt", "bank_name", "Bank")}
              {bankField("irt", "account_number", "Account number", "", true)}{bankField("irt", "iban", "IBAN", "IR…")}
              {bankField("irt", "card_number", "Card number", "", true)}
            </div></div>
          </div>
          <div className={ui.language} aria-label="Instructions language">
            <span>Customer notes</span><button type="button" aria-pressed={!fa} onClick={() => setLanguage("en")}>English</button><button type="button" aria-pressed={fa} onClick={() => setLanguage("fa")}>فارسی</button>
          </div>
          <div className={styles.fields}>
            <label className={styles.field}>AUD notes · {fa ? "فارسی" : "English"}<textarea rows={3} dir={fa ? "rtl" : "ltr"} lang={language} maxLength={4000}
              value={settings[fa ? "payment_instructions_aud_fa" : "payment_instructions_aud"] || ""} onChange={event => set(fa ? "payment_instructions_aud_fa" : "payment_instructions_aud", event.target.value)} /></label>
            <label className={styles.field}>Toman notes · {fa ? "فارسی" : "English"}<textarea rows={3} dir={fa ? "rtl" : "ltr"} lang={language} maxLength={4000}
              value={settings[fa ? "payment_instructions_irt_fa" : "payment_instructions_irt"] || ""} onChange={event => set(fa ? "payment_instructions_irt_fa" : "payment_instructions_irt", event.target.value)} /></label>
          </div>
        </section>
        <section id="request-notifications" className={ui.section} hidden={active !== "notifications"} aria-label="Management notifications">
          <label className={styles.field}>Management emails<textarea rows={4} autoCapitalize="none" spellCheck={false} value={emails} onChange={event => { setEmails(event.target.value); setDirty(true); setMessage(""); }} placeholder="One email per line" /></label>
          <p className={ui.hint}>New requests and customer replies notify this list. Choose email delivery when approving or messaging.</p>
        </section>
        <section id="request-timing" className={ui.section} hidden={active !== "timing"} aria-label="Hours and timing">
          <p className={ui.hint}>Handling starts after cleared funds and checks. The bank allowance is a review deadline, not a required wait. Calendar: Sydney.</p>
          <div className={styles.fields}>
            {number("standard_minutes", "Standard · business minutes", 1, 10080)}{number("priority_minutes", "Priority · business minutes", 1, 10080)}
            {number("quote_minutes", "Quote validity · minutes", 1, 60)}{number("funding_minutes", "Payment window · minutes", 1, 10080)}
            {number("australian_clearance_minutes", "AU bank review allowance · minutes (1440 = 24h)", 1440, 10080)}
            {number("opening_hour", "Opening hour", 0, 23)}{number("closing_hour", "Closing hour", 1, 24)}
          </div>
          <div className={styles.settingsDays}>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => <label key={day}><input type="checkbox" checked={settings.business_days.includes(index)} onChange={event => set("business_days", event.target.checked ? [...settings.business_days, index].sort() : settings.business_days.filter(value => value !== index))} />{day}</label>)}</div>
          <div className={styles.fields}>
            <label className={styles.field}>Holidays · YYYY-MM-DD<textarea rows={3} value={holidays} onChange={event => { setHolidays(event.target.value); setDirty(true); setMessage(""); }} /></label>
            <label className={styles.field}>Iran bank notice · English<textarea rows={3} maxLength={2000} value={settings.iran_banking_notice} onChange={event => set("iran_banking_notice", event.target.value)} /></label>
            <label className={styles.field}>Iran bank notice · فارسی<textarea rows={3} maxLength={2000} dir="rtl" lang="fa" value={settings.iran_banking_notice_fa || ""} onChange={event => set("iran_banking_notice_fa", event.target.value)} /></label>
          </div>
        </section>
        <section id="request-terms" className={ui.section} hidden={active !== "terms"} aria-label="Priority terms">
          <div className={styles.fields}>
            <label className={styles.field}>Priority terms · English<textarea rows={5} maxLength={4000} value={settings.priority_terms} onChange={event => set("priority_terms", event.target.value)} /></label>
            <label className={styles.field}>Priority terms · فارسی<textarea rows={5} maxLength={4000} dir="rtl" lang="fa" value={settings.priority_terms_fa} onChange={event => set("priority_terms_fa", event.target.value)} /></label>
          </div>
        </section>
      </fieldset>
    </form>}
  </details>;
}
