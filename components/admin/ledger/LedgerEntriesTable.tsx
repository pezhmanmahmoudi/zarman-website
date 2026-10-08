"use client";

import { useRef, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { updateLedgerEntry, addManualLedgerEntry, deleteLedgerEntry } from "@/app/actions/admin.actions";
import { AdminDataTable, AdminBadge, AdminTableRow, AdminTableCell, AdminTableIdentity, AdminTableDate } from "@/components/admin/ui/AdminDataTable";
import { AdminRecordDrawer } from "@/components/admin/ui/AdminRecordDrawer";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminToast } from "@/components/admin/ui/AdminToast";
import { useAdminFeedback } from "@/components/admin/ui/useAdminFeedback";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { filterBankAccountsByLedgerType, sortBankAccountsByPriority, type BankAccountLike } from "@/lib/bank-account-ordering";
import { parseAdminAmount } from "@/lib/admin-amount-input";
import { useAdminRefresh } from "@/components/admin/ui/useAdminRefresh";
import styles from "@/styles/admin/AdminWorkspace.module.css";

export type LedgerRow = {
  id: string; transaction_id: string | null; date_gregorian: string; date_jalali: string; created_at?: string;
  type: string; entry_type?: string; exchange_rate: number | string; amount_aud: number | string; amount_toman: number | string;
  payer_account_id: string | null; receiver_account_id: string | null; sender: string | null; recipient: string | null;
  fee_aud: number | string; notes: string | null;
};
type EntryType = "buy_aud" | "sell_aud" | "transfer";
type Draft = { id?: string; date: string; type: EntryType; rate: string; aud: string; toman: string; fee: string;
  payer_account_id: string; receiver_account_id: string; sender: string; recipient: string };
const entryType = (row: LedgerRow) => row.entry_type || (row.type === "transfer" ? "transfer" : "trade");
const editable = (row: LedgerRow) => ["trade", "transfer"].includes(entryType(row));
const entryLabel = (row: LedgerRow) => entryType(row) === "trade" ? row.type === "buy_aud" ? "Buy AUD" : "Sell AUD" : entryType(row).replaceAll("_", " ");
const amount = (value: number | string, currency: string) => `${Number(value).toLocaleString("en-AU", { maximumFractionDigits: currency === "AUD" ? 2 : 0 })} ${currency}`;
const parseOptional = (value: string) => !value.trim() || /^0+(?:\.0*)?$/.test(value.trim()) ? 0 : parseAdminAmount(value);

export function LedgerEntriesTable({ rows, bankAccounts, titleSlot }: { rows: LedgerRow[]; bankAccounts: BankAccountLike[]; titleSlot?: ReactNode }) {
  const refreshAdmin = useAdminRefresh();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const { confirm, showToast, dialogProps, toastProps } = useAdminFeedback();
  const selected = rows.find(row => row.id === selectedId);
  const accountName = (id: string | null) => bankAccounts.find(account => account.id === id)?.account_name || "—";
  const optionsFor = (type: EntryType, side: "payer" | "receiver") => {
    const accounts = type === "buy_aud"
      ? side === "payer" ? filterBankAccountsByLedgerType(bankAccounts, "buy_aud") : bankAccounts.filter(account => account.currency === "AUD")
      : type === "sell_aud"
        ? side === "payer" ? bankAccounts.filter(account => account.currency === "AUD") : filterBankAccountsByLedgerType(bankAccounts, "buy_aud")
        : bankAccounts;
    return sortBankAccountsByPriority(accounts).map(account => ({ value: account.id, label: account.account_name }));
  };
  const startEdit = (row?: LedgerRow) => {
    if (row && !editable(row)) return;
    setError("");
    setSelectedId(null);
    setDraft(row ? {
      id: row.id, date: row.date_gregorian.slice(0, 10), type: entryType(row) === "transfer" ? "transfer" : row.type === "sell_aud" ? "sell_aud" : "buy_aud",
      rate: String(Number(row.exchange_rate) || (Number(row.amount_aud) > 0 ? Number(row.amount_toman) / Number(row.amount_aud) : 0)),
      aud: String(row.amount_aud), toman: String(row.amount_toman), fee: String(row.fee_aud || 0),
      payer_account_id: row.payer_account_id || "", receiver_account_id: row.receiver_account_id || "", sender: row.sender || "", recipient: row.recipient || "",
    } : { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
      type: "buy_aud", rate: "", aud: "", toman: "", fee: "", payer_account_id: "", receiver_account_id: "", sender: "", recipient: "" });
  };
  const setField = (field: keyof Draft, value: string) => { setDraft(current => current ? { ...current, [field]: value } : null); setError(""); };
  const changeType = (value: string) => {
    const type = value as EntryType;
    setDraft(current => current ? { ...current, type,
      payer_account_id: optionsFor(type, "payer").some(option => option.value === current.payer_account_id) ? current.payer_account_id : "",
      receiver_account_id: optionsFor(type, "receiver").some(option => option.value === current.receiver_account_id) ? current.receiver_account_id : "",
    } : null);
    setError("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || submitting.current) return;
    const aud = parseOptional(draft.aud), toman = parseOptional(draft.toman), rate = parseOptional(draft.rate), fee = parseOptional(draft.fee);
    if ([aud, toman, rate, fee].some(value => value === null)) { setError("Enter valid amounts, such as 1,250 or 1250.50."); return; }
    if (aud! <= 0 && toman! <= 0) { setError("Enter an AUD or Toman amount greater than zero."); return; }
    if (draft.type !== "transfer" && (aud! <= 0 || toman! <= 0)) { setError("Trades require both AUD and Toman amounts."); return; }
    const entryDate = new Date(draft.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(entryDate.getTime()) || entryDate.toISOString().slice(0, 10) !== draft.date) { setError("Choose a valid entry date."); return; }
    if (draft.type === "transfer" && (!draft.payer_account_id || !draft.receiver_account_id || draft.payer_account_id === draft.receiver_account_id)) {
      setError("Transfers require two different bank accounts."); return;
    }
    submitting.current = true; setSaving(true); setError("");
    try {
      const result = draft.id ? await updateLedgerEntry(draft.id, {
        date_gregorian: draft.date, type: draft.type, exchange_rate: rate! > 0 ? rate! : undefined,
        amount_aud: aud!, amount_toman: toman!, fee_aud: fee!, payer_account_id: draft.payer_account_id || null,
        receiver_account_id: draft.receiver_account_id || null, sender: draft.sender, recipient: draft.recipient,
      }) : await addManualLedgerEntry({
        dateGregorian: draft.date, type: draft.type, exchangeRate: rate! > 0 ? rate! : undefined,
        amountAud: aud!, amountToman: toman!, feeAud: fee! || undefined, entry_type: draft.type === "transfer" ? "transfer" : "trade",
        payer_account_id: draft.payer_account_id || null, receiver_account_id: draft.receiver_account_id || null,
        sender: draft.sender, recipient: draft.recipient,
      });
      if ("error" in result) setError(result.error);
      else { setDraft(null); refreshAdmin(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the entry. Please try again."); }
    finally { submitting.current = false; setSaving(false); }
  };
  const remove = (row: LedgerRow) => confirm({
    title: "Delete ledger entry", message: "Delete this entry and its linked accounting records? This cannot be undone.", confirmLabel: "Delete", variant: "reject",
    onConfirm: async () => {
      const result = await deleteLedgerEntry(row.id);
      if ("error" in result) showToast({ type: "error", message: result.error });
      else refreshAdmin();
    },
  });
  return <>
    <AdminConfirmDialog {...dialogProps} /><AdminToast {...toastProps} />
    <div className={styles.toolbar}>{titleSlot || <h2 className={styles.panelTitle}>Ledger entries</h2>}
      <button type="button" className={styles.action} onClick={() => startEdit()} disabled={saving}><Plus size={15} aria-hidden="true" />Add entry</button>
    </div>
    <AdminDataTable label="Ledger entries" columns={[
      { key: "customer", label: "Customer / recipient" }, { key: "type", label: "Type" }, { key: "accounts", label: "Accounts" },
      { key: "aud", label: "AUD amount", align: "end" }, { key: "toman", label: "Toman amount", align: "end" },
      { key: "date", label: "Date" }, { key: "actions", label: "Actions", actions: true },
    ]} empty={!rows.length && <><strong>No ledger entries</strong><p>Try another filter or add an entry.</p></>}>
      {rows.map(row => <AdminTableRow key={row.id}>
        <AdminTableCell kind="primary"><AdminTableIdentity name={row.sender || "No sender recorded"} detail={row.recipient ? <>To <bdi>{row.recipient}</bdi></> : undefined} /></AdminTableCell>
        <AdminTableCell label="Type"><AdminBadge tone={entryType(row) === "trade" ? row.type === "buy_aud" ? "review" : "success" : "closed"}>{entryLabel(row)}</AdminBadge></AdminTableCell>
        <AdminTableCell label="Accounts"><span className={styles.detail}>From <bdi>{accountName(row.payer_account_id)}</bdi></span><span className={styles.detail}>To <bdi>{accountName(row.receiver_account_id)}</bdi></span></AdminTableCell>
        <AdminTableCell label="AUD amount" align="right"><strong dir="ltr">{amount(row.amount_aud, "AUD")}</strong></AdminTableCell>
        <AdminTableCell label="Toman amount" align="right"><span dir="ltr">{amount(row.amount_toman, "Toman")}</span></AdminTableCell>
        <AdminTableCell label="Date"><AdminTableDate value={row.date_gregorian} /></AdminTableCell>
        <AdminTableCell kind="actions">{editable(row) && <>
          <button type="button" className={styles.action} onClick={() => startEdit(row)}><Pencil size={14} aria-hidden="true" />Edit</button>
          <button type="button" className={`${styles.action} ${styles.rejectAction}`} onClick={() => remove(row)}><Trash2 size={14} aria-hidden="true" />Delete</button>
        </>}<button type="button" className={styles.detailsToggle} aria-haspopup="dialog" onClick={() => setSelectedId(row.id)} aria-label={`View ledger entry ${row.id}`}>View</button></AdminTableCell>
      </AdminTableRow>)}
    </AdminDataTable>
    {selected && <AdminRecordDrawer title={selected.sender || "Ledger entry"} subtitle={selected.id} eyebrow="Ledger details" onClose={() => setSelectedId(null)}>
      <section className={styles.detailSection}><h3>Transfer</h3><dl className={styles.facts}>
        {[["Sender", selected.sender], ["Recipient", selected.recipient], ["Entry type", entryLabel(selected)], ["Exchange rate", amount(selected.exchange_rate, "Toman / AUD")],
          ["AUD amount", amount(selected.amount_aud, "AUD")], ["Toman amount", amount(selected.amount_toman, "Toman")], ["Fee", amount(selected.fee_aud, "AUD")],
          ["Paying account", accountName(selected.payer_account_id)], ["Receiving account", accountName(selected.receiver_account_id)],
          ["Entry date", selected.date_gregorian], ["Recorded Jalali date", selected.date_jalali], ["Transaction ID", selected.transaction_id],
        ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value || "—"}</bdi></dd></div>)}
      </dl></section>
      {selected.created_at && <section className={styles.detailSection}><h3>Created · Sydney time</h3><AdminTableDate value={selected.created_at} time /></section>}
      {selected.notes && <section className={styles.detailSection}><h3>Notes</h3><p className={styles.description} dir="auto">{selected.notes}</p></section>}
    </AdminRecordDrawer>}
    {draft && <AdminRecordDrawer title={draft.id ? "Edit ledger entry" : "Add ledger entry"} eyebrow="Ledger" subtitle={draft.id} busy={saving} onClose={() => { if (!submitting.current) setDraft(null); }}
      footer={<div className={styles.headerActions}><button type="button" className={styles.action} disabled={saving} onClick={() => setDraft(null)}>Cancel</button>
        <button type="submit" form="ledger-entry-editor" className={`${styles.action} ${styles.primaryAction}`} disabled={saving}>{saving ? "Saving…" : "Save entry"}</button></div>}>
      <form id="ledger-entry-editor" className={styles.editorForm} onSubmit={save} aria-busy={saving}>
        <fieldset className={styles.editorFields} disabled={saving}>
          <label>Date<CustomDatePicker value={draft.date} onChange={value => setField("date", value)} placeholder="Entry date" disabled={saving} /></label>
          <label>Type<SelectBox dir="ltr" placeholder="Entry type" value={draft.type} onChange={changeType} disabled={saving} labeledOptions={[{ label: "Buy AUD", value: "buy_aud" }, { label: "Sell AUD", value: "sell_aud" }, { label: "Transfer", value: "transfer" }]} /></label>
          <label>Sender<input value={draft.sender} onChange={event => setField("sender", event.target.value)} dir="auto" /></label>
          <label>Recipient<input value={draft.recipient} onChange={event => setField("recipient", event.target.value)} dir="auto" /></label>
          <label data-wide>Paying account<SelectBox dir="ltr" placeholder="Paying account" value={draft.payer_account_id} disabled={saving} onChange={value => setField("payer_account_id", value)} labeledOptions={[{ label: "Select account", value: "" }, ...optionsFor(draft.type, "payer")]} /></label>
          <label data-wide>Receiving account<SelectBox dir="ltr" placeholder="Receiving account" value={draft.receiver_account_id} disabled={saving} onChange={value => setField("receiver_account_id", value)} labeledOptions={[{ label: "Select account", value: "" }, ...optionsFor(draft.type, "receiver")]} /></label>
          {([["aud", "AUD amount"], ["toman", "Toman amount"], ["rate", "Exchange rate"], ["fee", "Fee (AUD)"]] as const).map(([field, label]) => <label key={field}>{label}<input inputMode="decimal" dir="ltr" value={draft[field]} onChange={event => setField(field, event.target.value)} aria-describedby={error ? "ledger-entry-error" : undefined} /></label>)}
        </fieldset>
        {error && <p className={styles.error} id="ledger-entry-error" role="alert">{error}</p>}
      </form>
    </AdminRecordDrawer>}
  </>;
}
