"use client";

import { useState } from "react";
import { Check, GraduationCap, Landmark, Plus, Search, X } from "lucide-react";
import type { Recipient, RecipientDirection } from "@/app/[locale]/dashboard/dashboard.types";
import { DashboardInitials } from "./DashboardInitials";
import { DashboardButton } from "./dashboard-ui";
import { dashboardNumber, normaliseAmountDigits } from "@/lib/dashboard/numbers";
import styles from "@/styles/dashboard/TransferRecipientPicker.module.css";

export const EDUCATION_RECIPIENT_ID = "__edu_exam__";
type Props = {
  recipients: Recipient[];
  direction: RecipientDirection;
  selectedId: string;
  locale: string;
  status: "loading" | "ready" | "error";
  disabled?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onAddSelf: () => void;
  onRetry: () => void;
};

const normalize = (value: string) => normaliseAmountDigits(value.normalize("NFKC"))
  .replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\u200d]/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase();
const displayName = (recipient: Recipient) => recipient.account_name || recipient.full_name || recipient.label;
export const accountTail = (recipient: Recipient) => (recipient.direction === "aud" ? recipient.account_number : recipient.shaba_number || recipient.irt_account_number || recipient.card_number)?.replace(/\s|-/g, "").slice(-4) || "";

export function TransferRecipientPicker({ recipients, direction, selectedId, locale, status, disabled = false, onSelect, onAdd, onAddSelf, onRetry }: Props) {
  const [query, setQuery] = useState("");
  const fa = locale === "fa";
  const text = (en: string, persian: string) => fa ? persian : en;
  // The API records when accounts were saved, not when they were last paid.
  const eligible = recipients.filter(recipient => recipient.direction === direction).sort((a, b) =>
    (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0));
  const term = normalize(query);
  const matches = eligible.filter(recipient => normalize([displayName(recipient), recipient.label, recipient.bank_name, recipient.bank_city, accountTail(recipient)].filter(Boolean).join(" ")).includes(term));
  const selectedAccount = eligible.find(recipient => recipient.id === selectedId);
  const button = styles.action;
  const selectionMark = <span className={styles.selectionMark} aria-hidden="true"><Check size={18} strokeWidth={2}/></span>;

  return <fieldset className={styles.picker} disabled={disabled} dir={fa ? "rtl" : "ltr"}>
    <legend className="sr-only">{text("Choose one recipient", "انتخاب یک گیرنده")}</legend>
    <div className={styles.toolbar}>
      {eligible.length > 0 && status === "ready" && <div className={styles.search}>
        <Search size={18} aria-hidden="true"/>
        <input type="search" value={query} aria-label={text("Search recipients by name, bank or last four digits", "جستجوی گیرنده با نام، بانک یا چهار رقم آخر حساب")}
          placeholder={text("Search name, bank or last 4 digits", "نام، بانک یا چهار رقم آخر حساب")}
          onChange={event => setQuery(event.target.value)} autoComplete="off" spellCheck={false}/>
        {query && <button type="button" className={styles.clear} aria-label={text("Clear search", "پاک کردن جستجو")} onClick={() => setQuery("")}><X size={16} aria-hidden="true"/></button>}
      </div>}
      <DashboardButton asChild className={styles.addRecipient}><button type="button" onClick={onAdd}><Plus size={18} aria-hidden="true"/>{text("Add recipient", "افزودن گیرنده")}</button></DashboardButton>
    </div>

    {status === "loading" ? <p role="status" className={styles.message}>{text("Loading your recipients…", "در حال دریافت گیرندگان…")}</p>
      : status === "error" ? <div className={styles.empty}><p role="alert">{text("We couldn’t load your recipients. Please try again.", "دریافت گیرندگان ممکن نشد. لطفاً دوباره تلاش کنید.")}</p><button type="button" className={button} onClick={onRetry}>{text("Try again", "تلاش دوباره")}</button></div>
        : eligible.length === 0 ? <p className={styles.message}>{text("No saved recipients in this destination yet. Add a recipient to get started.", "هنوز گیرنده‌ای در این مقصد ذخیره نکرده‌اید. برای شروع، یک گیرنده اضافه کنید.")}</p>
          : <>
            <div className={styles.listHeading}><span>{text("Saved recipients", "گیرندگان ذخیره‌شده")}</span><span role="status" aria-live="polite">{term ? text(`${dashboardNumber(matches.length, locale)} matches`, `${dashboardNumber(matches.length, locale)} نتیجه`) : ""}</span></div>
            {matches.length === 0 ? <div className={styles.empty}><p>{text("No matching recipients.", "گیرنده‌ای با این مشخصات پیدا نشد.")}</p><button type="button" className={button} onClick={() => setQuery("")}>{text("Clear search", "پاک کردن جستجو")}</button></div>
              : <div className={styles.list} data-scrollable={matches.length > 6}>{matches.map(recipient => {
                const name = displayName(recipient), tail = accountTail(recipient);
                return <label key={recipient.id} className={styles.row} data-tone={["sky", "violet", "rose"][eligible.findIndex(item => item.id === recipient.id) % 3]} data-selected={selectedId === recipient.id} data-recipient-id={recipient.id}>
                  <input className={styles.choiceInput} type="radio" name="transfer-recipient" value={recipient.id} checked={selectedId === recipient.id} onChange={() => onSelect(recipient.id)}/>
                  <span className={styles.cardTop}><span className={styles.avatar}><DashboardInitials name={name}/></span>{selectedId === recipient.id && selectionMark}</span>
                  <span className={styles.details}>
                    <bdi className={styles.name} data-private-value>{name}</bdi>
                    {recipient.label && recipient.label !== name && <bdi className={styles.alias} data-private-value>{recipient.label}</bdi>}
                  </span>
                  <span className={styles.bank}><bdi>{recipient.bank_name || text("Bank account", "حساب بانکی")}</bdi>{tail && <bdi dir="ltr" data-private-value>•••• {tail}</bdi>}</span>
                </label>;
              })}</div>}
            {selectedAccount && !matches.some(recipient => recipient.id === selectedId) && <p className={styles.message} role="status">{text("Selected recipient:", "گیرندهٔ انتخاب‌شده:")} <bdi data-private-value>{displayName(selectedAccount)}</bdi></p>}
          </>}

    <div className={styles.other}>
      <p className={styles.otherTitle}>{text("Other ways to send", "روش‌های دیگر انتقال")}</p>
      <div className={styles.otherGrid}>
      <button type="button" className={`${styles.row} ${styles.compact} ${styles.self}`} onClick={onAddSelf}>
        <span className={styles.specialIcon}><Landmark size={20} aria-hidden="true"/></span>
        <span className={styles.details}><span className={styles.name}>{text("My own account", "حساب شخصی من")}</span><span className={styles.alias}>{direction === "aud" ? text("Add my account in Australia", "افزودن حساب من در استرالیا") : text("Add my account in Iran", "افزودن حساب من در ایران")}</span></span>
        <span className={styles.addMark} aria-hidden="true"><Plus size={14} strokeWidth={2.5}/></span>
      </button>
      <label className={`${styles.row} ${styles.compact} ${styles.education}`} data-selected={selectedId === EDUCATION_RECIPIENT_ID}>
        <input className={styles.choiceInput} type="radio" name="transfer-recipient" value={EDUCATION_RECIPIENT_ID} checked={selectedId === EDUCATION_RECIPIENT_ID} onChange={() => onSelect(EDUCATION_RECIPIENT_ID)}/>
        <span className={styles.specialIcon}><GraduationCap size={21} aria-hidden="true"/></span>
        <span className={styles.details}><span className={styles.name}>{text("University & institution", "دانشگاه و مؤسسه")}</span><span className={styles.alias}>{text("Pay tuition, exams or an invoice", "پرداخت شهریه، آزمون یا صورتحساب")}</span></span>
        <span className={styles.radio} data-selected={selectedId === EDUCATION_RECIPIENT_ID} aria-hidden="true">{selectedId === EDUCATION_RECIPIENT_ID && <Check size={14} strokeWidth={3}/>}</span>
      </label>
      </div>
    </div>
  </fieldset>;
}
