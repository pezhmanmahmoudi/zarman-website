"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2, ArrowRight } from "lucide-react";
import { updateLedgerEntry, addManualLedgerEntry, deleteLedgerEntry } from "@/app/actions/admin.actions";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import s from "@/styles/admin/LedgerTable.module.css";
import { SelectBox } from "@/components/ui/SelectBox/SelectBox";
import CustomDatePicker from "@/components/ui/DatePicker/CustomDatePicker";
import { filterBankAccountsByLedgerType, sortBankAccountsByPriority } from "@/lib/bank-account-ordering";

// -- Persian strings ----------------
const T = {
  buy:        "خرید",
  sell:       "فروش",
  transfer:   "انتقال",
  expense:    "هزینه",
  ownerLoan:  "وام مالک",
  adjustment: "اصلاح حساب",
  addRow:     "افزودن سطر",
  save:       "ذخیره",
  cancel:     "لغو",
  edit:       "ویرایش",
  del:        "حذف",
  delConfirm: "حذف شود؟",
  colDate:    "تاریخ",
  colType:    "نوع",
  colPockets: "مسیر بانکی (پرداخت‌کننده ⬅ دریافت‌کننده)",
  colCustomers: "طرف حساب (فرستنده ⬅ گیرنده)",
  colRate:    "نرخ",
  colAud:     "AUD ($)",
  colToman:   "Toman (IRT)",
  colFee:     "کارمزد",
  colActions: "عملیات",
  colDel:     "حذف",
  errAmount:  "حداقل یکی از مبالغ دلار یا تومان باید بیشتر از صفر باشد.",
  errTradeAmounts: "برای معامله، مبلغ AUD و IRT هر دو الزامی هستند.",
  errFee:     "کارمزد نامعتبر",
  months: [
    "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
    "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
  ],
};

// -- Gregorian to Jalali ----------------------------------------------------
function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gy1 = gy - 1600, gm1 = gm - 1, gd1 = gd - 1;
  let g_d_no = 365 * gy1 + Math.floor((gy1 + 3) / 4) - Math.floor((gy1 + 99) / 100) + Math.floor((gy1 + 399) / 400);
  const mDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) mDays[1] = 29;
  for (let i = 0; i < gm1; i++) g_d_no += mDays[i];
  g_d_no += gd1;
  let j_d_no = g_d_no - 79;
  const j_np = Math.floor(j_d_no / 12053); j_d_no %= 12053;
  let jy = 979 + 33 * j_np + 4 * Math.floor(j_d_no / 1461); j_d_no %= 1461;
  if (j_d_no >= 366) { jy += Math.floor((j_d_no - 1) / 365); j_d_no = (j_d_no - 1) % 365; }
  const jm2 = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let jm = 0;
  for (jm = 0; jm < 11 && j_d_no >= jm2[jm]; jm++) j_d_no -= jm2[jm];
  return [jy, jm + 1, j_d_no + 1];
}
function gregToJalali(yyyymmdd: string): string {
  if (!yyyymmdd) return "—";
  const parts = yyyymmdd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "—";
  const [jy, jm, jd] = toJalali(parts[0], parts[1], parts[2]);
  if (jm < 1 || jm > 12) return "—";
  return `${jd} ${T.months[jm - 1]} ${jy}`;
}
function storedToJalali(stored: string): string {
  const parts = stored.split("/");
  if (parts.length !== 3) return stored;
  const [y, m, d] = parts.map(Number);
  if (!m || m < 1 || m > 12) return stored;
  return `${d} ${T.months[m - 1]} ${y}`;
}

// -- Helpers ----------------------------------------------------------------
function isoToDateInput(s: string): string { return s.slice(0, 10); }
function fmtGreg(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtAUD(v: number)  { return v.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtIRT(v: number)  { return Math.round(v).toLocaleString("en-AU"); }
function fmtRate(v: number) { return Math.round(v).toLocaleString("en-AU"); }
function today()            { return new Date().toISOString().slice(0, 10); }
function typeLabel(type: string) {
  if (type === "transfer") return T.transfer;
  if (type === "expense") return T.expense;
  if (type === "owner_loan") return T.ownerLoan;
  if (type === "adjustment") return T.adjustment;
  if (type === "sell_aud") return T.sell;
  return T.buy;
}

function effectiveEntryType(row: LedgerRow): string {
  return row.entry_type ?? "trade";
}

function rowTypeLabel(row: LedgerRow): string {
  const entryType = effectiveEntryType(row);
  return typeLabel(entryType === "trade" ? row.type : entryType);
}

function isTradeOrTransfer(row: LedgerRow): boolean {
  return ["trade", "transfer"].includes(effectiveEntryType(row));
}

// -- Types ------------------------------------------------------------------
export type LedgerRow = {
  id: string;
  transaction_id: string | null;
  date_gregorian: string;
  date_jalali: string;
  type: string;
  entry_type?: string;
  exchange_rate: number | string;
  amount_aud: number | string;
  amount_toman: number | string;
  payer_account_id: string | null;
  receiver_account_id: string | null;
  sender: string | null;
  recipient: string | null;
  fee_aud: number | string;
  notes: string | null;
};
interface Props { 
  rows: LedgerRow[];
  bankAccounts: any[];
  titleSlot?: React.ReactNode;
}

type EditState = {
  id: string; date: string; type: "buy_aud" | "sell_aud" | "transfer";
  rate: string; aud: string; toman: string;
  payer_account_id: string; receiver_account_id: string; 
  sender: string; recipient: string;
  fee: string; err: string | null;
};
type AddState = {
  date: string; type: "buy_aud" | "sell_aud" | "transfer";
  rate: string; aud: string; toman: string;
  payer_account_id: string; receiver_account_id: string; 
  sender: string; recipient: string;
  fee: string; err: string | null;
};

const emptyAdd = (): AddState => ({
  date: today(), type: "buy_aud",
  rate: "", aud: "", toman: "", payer_account_id: "", receiver_account_id: "", 
  sender: "", recipient: "", fee: "", err: null,
});

const TH_FA: React.CSSProperties = { textAlign: "center", fontFamily: "var(--font-fa-content)", direction: "rtl", padding: "0.8rem 0.6rem", whiteSpace: "nowrap" };
const TH_EN: React.CSSProperties = { textAlign: "right",  fontFamily: "var(--font-en-stack)",   direction: "ltr", padding: "0.8rem 0.8rem", whiteSpace: "nowrap" };
// -- Component --------------------------------------------------------------
export function EditableLedgerTable({ rows, bankAccounts, titleSlot }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [edit,    setEdit]    = useState<EditState | null>(null);
  const [add,     setAdd]     = useState<AddState  | null>(null);
  const [delId,   setDelId]   = useState<string    | null>(null);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);
  const topScrollSpacerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const top = topScrollRef.current;
    const main = mainScrollRef.current;
    const spacer = topScrollSpacerRef.current;
    if (!top || !main || !spacer) return;

    let isSyncing = false;

    const syncMetrics = () => {
      // Spacer = full table content width; rail = visible wrapper width (set by CSS).
      // Since rail < spacer when overflowing, browser renders a real scrollbar.
      spacer.style.width = `${main.scrollWidth}px`;
      setHasHorizontalOverflow(main.scrollWidth > main.clientWidth + 1);
    };

    const onTopScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      main.scrollLeft = top.scrollLeft;
      isSyncing = false;
    };

    const onMainScroll = () => {
      if (isSyncing) return;
      isSyncing = true;
      top.scrollLeft = main.scrollLeft;
      isSyncing = false;
    };

    syncMetrics();
    top.addEventListener("scroll", onTopScroll, { passive: true });
    main.addEventListener("scroll", onMainScroll, { passive: true });
    window.addEventListener("resize", syncMetrics);

    const ro = new ResizeObserver(syncMetrics);
    ro.observe(main);

    return () => {
      top.removeEventListener("scroll", onTopScroll);
      main.removeEventListener("scroll", onMainScroll);
      window.removeEventListener("resize", syncMetrics);
      ro.disconnect();
    };
  }, [rows.length, bankAccounts.length, !!add, !!edit]);

  const eSet = (f: keyof EditState, v: string) => setEdit(e => e ? { ...e, [f]: v } : null);
  const aSet = (f: keyof AddState,  v: string) => setAdd(a  => a ? { ...a, [f]: v } : null);

  const startEdit = (row: LedgerRow) => {
      const aud = Number(row.amount_aud), tom = Number(row.amount_toman);
      setEdit({
        id: row.id, date: isoToDateInput(row.date_gregorian),
        // 🌟 این خط تغییر کرده است:
        type: row.entry_type === "transfer" ? "transfer" : (row.type as any) || "buy_aud",
        
        rate: Number(row.exchange_rate) > 0 ? String(Math.round(Number(row.exchange_rate))) : aud > 0 ? String(Math.round(tom / aud)) : "",
        aud: aud > 0 ? String(aud) : "", 
        toman: tom > 0 ? String(tom) : "",
        payer_account_id: row.payer_account_id || "", 
        receiver_account_id: row.receiver_account_id || "",
        sender: row.sender || "",
        recipient: row.recipient || "",
        fee: Number(row.fee_aud) > 0 ? String(Number(row.fee_aud)) : "", err: null,
      });
      setAdd(null); setDelId(null);
    };

  const parseF = (s: string) => parseFloat(s.replace(/,/g, ""));

  const saveEdit = () => {
    if (!edit) return;
    const aud = parseF(edit.aud) || 0;
    const tom = parseF(edit.toman) || 0;
    const rate = parseF(edit.rate) || 0;
    const fee = edit.fee.trim() ? parseF(edit.fee) : 0;
    
    // محافظت جدید: فقط کافی است یکی از مبالغ دلار یا تومان پر شده باشد
    if (aud <= 0 && tom <= 0) { 
      setEdit({ ...edit, err: T.errAmount }); 
      return; 
    }
    if (edit.type !== "transfer" && (aud <= 0 || tom <= 0)) {
      setEdit({ ...edit, err: T.errTradeAmounts });
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) { 
      setEdit({ ...edit, err: T.errFee }); 
      return; 
    }
    
    setEdit({ ...edit, err: null });
    start(async () => {
      const res = await updateLedgerEntry(edit.id, {
        date_gregorian: edit.date || undefined, type: edit.type as any,
        exchange_rate: rate > 0 ? rate : undefined,
        amount_aud: aud, amount_toman: tom, 
        payer_account_id: edit.payer_account_id || null, 
        receiver_account_id: edit.receiver_account_id || null, 
        sender: edit.sender,
        recipient: edit.recipient,
        fee_aud: fee,
      });
      if ("error" in res) setEdit(e => e ? { ...e, err: res.error } : null);
      else { setEdit(null); router.refresh(); }
    });
  };

  const saveAdd = () => {
    if (!add) return;
    const aud = parseF(add.aud) || 0;
    const tom = parseF(add.toman) || 0;
    const rate = parseF(add.rate) || 0;
    const fee = add.fee.trim() ? parseF(add.fee) : 0;
    
    // محافظت جدید: فقط کافی است یکی از مبالغ دلار یا تومان پر شده باشد
    if (aud <= 0 && tom <= 0) { 
      setAdd({ ...add, err: T.errAmount }); 
      return; 
    }
    if (add.type !== "transfer" && (aud <= 0 || tom <= 0)) {
      setAdd({ ...add, err: T.errTradeAmounts });
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) { 
      setAdd({ ...add, err: T.errFee }); 
      return; 
    }
    
    setAdd({ ...add, err: null });
    start(async () => {
      const res = await addManualLedgerEntry({
        type: add.type as any, amountAud: aud, amountToman: tom,
        exchangeRate: rate > 0 ? rate : undefined,
        payer_account_id: add.payer_account_id || null, 
        receiver_account_id: add.receiver_account_id || null,
        sender: add.sender,
        recipient: add.recipient,
        entry_type: add.type === "transfer" ? "transfer" : "trade",
        feeAud: fee || undefined, dateGregorian: add.date || undefined,
      });
      if ("error" in res) setAdd(a => a ? { ...a, err: res.error } : null);
      else { setAdd(null); router.refresh(); }
    });
  };

  const doDelete = (id: string) => {
    start(async () => {
      await deleteLedgerEntry(id);
      setDelId(null); router.refresh();
    });
  };

  const getAccountName = (id: string | null) => {
    if (!id) return "—";
    const acc = bankAccounts.find(b => String(b.id) === String(id));
    return acc ? `${acc.account_name}` : "—";
  };

  const getBankAccountOptions = (transactionType: string) => {
    const filtered = filterBankAccountsByLedgerType(bankAccounts, transactionType);
    return sortBankAccountsByPriority(filtered).map((account) => ({
      value: account.id,
      label: account.account_name,
    }));
  };

  const getLedgerAccountOptions = (transactionType: string, side: "payer" | "receiver") => {
    const sideAccounts = transactionType === "buy_aud"
      ? (side === "payer"
          ? sortBankAccountsByPriority(bankAccounts.filter((account) => account.currency === "IRT"))
          : sortBankAccountsByPriority(bankAccounts.filter((account) => account.currency === "AUD")))
      : transactionType === "sell_aud"
        ? (side === "payer"
            ? sortBankAccountsByPriority(bankAccounts.filter((account) => account.currency === "AUD"))
            : sortBankAccountsByPriority(bankAccounts.filter((account) => account.currency === "IRT")))
      : sortBankAccountsByPriority(filterBankAccountsByLedgerType(bankAccounts, transactionType));

    return sideAccounts.map((account) => ({
      value: account.id,
      label: account.account_name,
    }));
  };

  const openAdd = () => { setAdd(emptyAdd()); setEdit(null); setDelId(null); };

  const kbE = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEdit(null); };
  const kbA = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveAdd();  if (e.key === "Escape") setAdd(null); };
  const busy = isPending || !!edit || !!add || !!delId;

  const ErrLine = ({ msg }: { msg: string | null }) => msg ? <p className={s.errLine}>{msg}</p> : null;

  return (
    <div>
      <div className={s.toolbar}>
        {titleSlot && <div className={s.toolbarTitle}>{titleSlot}</div>}
        <button className={s.addBtn} onClick={openAdd} disabled={!!add || isPending}>
          <Plus size={14} />{T.addRow}
        </button>
      </div>

      <div className={s.tableShell}>
        {/* ── Horizontal scroll rail — lives OUTSIDE the table so it has its
             own natural width (= wrapper clientWidth). The spacer is set to
             scrollWidth, so the rail overflows and shows a real scrollbar. ── */}
        <div
          className={`${s.scrollRailOuter} ${hasHorizontalOverflow ? "" : s.scrollRailHidden}`}
          aria-hidden="true"
        >
          <div
            ref={topScrollRef}
            className={s.topScrollBar}
          >
            <div ref={topScrollSpacerRef} className={s.topScrollSpacer} />
          </div>
        </div>

        <div
          ref={mainScrollRef}
          className={`${tableStyles.tableWrap} ${s.desktopOnly}`}
        >
          <table className={`${tableStyles.table} ${s.ledgerTable}`} dir="rtl" style={{ minWidth: "1320px" }}>
          <colgroup>
            <col style={{ width: "116px" }} />
            <col style={{ width: "176px" }} />
            <col style={{ width: "108px" }} />
            <col />
            <col />
            <col style={{ width: "108px" }} />
            <col style={{ width: "108px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "92px" }} />
            <col style={{ width: "52px" }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...TH_FA, width: 116, minWidth: 116 }}>{T.colActions}</th>
              <th style={{ ...TH_FA, textAlign: "center", width: 176, minWidth: 176 }}>{T.colDate}</th>
              <th style={{ ...TH_FA, width: 108, minWidth: 108 }}>{T.colType}</th>
              <th style={{ ...TH_FA }}>{T.colCustomers}</th>
              <th style={{ ...TH_FA }}>{T.colPockets}</th>
              <th style={TH_EN}>{T.colRate}</th>
              <th style={TH_EN}>{T.colAud}</th>
              <th style={TH_EN}>{T.colToman}</th>
              <th style={TH_EN}>{T.colFee}</th>
              <th style={{ ...TH_FA, width: 52, minWidth: 52 }}>{T.colDel}</th>
            </tr>
          </thead>
          <tbody>
            {/* ── Add row ── */}
            {add && (
              <tr className={s.rowAdd}>
                <td className={s.tdActions}>
                  <div className={s.btnRow}>
                    <button className={s.btnSave} onClick={saveAdd} disabled={isPending}><Check size={12} />{T.save}</button>
                    <button className={s.btnCancel} onClick={() => setAdd(null)}><X size={13} /></button>
                  </div>
                  <ErrLine msg={add.err} />
                </td>
                <td className={s.tdDateCenter}>
                  <div className={s.dateEditStack}>
                    <div className={s.datePickerWrap}>
                      <CustomDatePicker value={add.date} onChange={(val) => aSet("date", val)} />
                    </div>
                    <p className={`${s.jalaliLive} ${s.jalaliLiveOverlay}`}>{gregToJalali(add.date)}</p>
                  </div>
                </td>
                <td className={s.tdCenter}>
                  <SelectBox
                    className={s.selectType}
                    labeledOptions={[
                      { value: "buy_aud", label: T.buy },
                      { value: "sell_aud", label: T.sell },
                      { value: "transfer", label: T.transfer },
                    ]}
                    value={add.type}
                    onChange={(val) => {
                      const nextType = val as any;
                      aSet("type", nextType);
                      if (nextType === "buy_aud") {
                        if (add.payer_account_id && bankAccounts.find((account) => account.id === add.payer_account_id)?.currency !== "IRT") {
                          aSet("payer_account_id", "");
                        }
                        if (add.receiver_account_id && bankAccounts.find((account) => account.id === add.receiver_account_id)?.currency !== "AUD") {
                          aSet("receiver_account_id", "");
                        }
                      } else if (nextType === "sell_aud") {
                        if (add.payer_account_id && bankAccounts.find((account) => account.id === add.payer_account_id)?.currency !== "AUD") {
                          aSet("payer_account_id", "");
                        }
                        if (add.receiver_account_id && bankAccounts.find((account) => account.id === add.receiver_account_id)?.currency !== "IRT") {
                          aSet("receiver_account_id", "");
                        }
                      }
                    }}
                  />
                </td>
                <td className={s.tdCenter}>
                  <div className={s.fieldStack}>
                    <input type="text" className={s.inputTxt} value={add.sender} onChange={e => aSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbA} />
                    <input type="text" className={s.inputTxt} value={add.recipient} onChange={e => aSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbA} />
                  </div>
                </td>
                <td className={s.tdCenter}>
                  <div className={s.fieldStack}>
                    <SelectBox
                      className={s.selectType}
                      labeledOptions={[
                        { value: "", label: "حساب دریافت کننده..." },
                        ...getLedgerAccountOptions(add.type, "receiver"),
                      ]}
                      value={add.receiver_account_id}
                      onChange={(val) => aSet("receiver_account_id", val)}
                    />
                    <SelectBox
                      className={s.selectType}
                      labeledOptions={[
                        { value: "", label: "حساب پرداخت کننده..." },
                        ...getLedgerAccountOptions(add.type, "payer"),
                      ]}
                      value={add.payer_account_id}
                      onChange={(val) => aSet("payer_account_id", val)}
                    />
                  </div>
                </td>
                <td className={s.tdNum}><input type="text" inputMode="decimal" className={s.inputNum} value={add.rate} onChange={e => aSet("rate", e.target.value)} placeholder="0" onKeyDown={kbA} /></td>
                <td className={s.tdNum}><input type="text" inputMode="decimal" className={s.inputNum} value={add.aud} onChange={e => aSet("aud", e.target.value)} placeholder="0.00" onKeyDown={kbA} /></td>
                <td className={s.tdNum}><input type="text" inputMode="decimal" className={s.inputNum} value={add.toman} onChange={e => aSet("toman", e.target.value)} placeholder="0" onKeyDown={kbA} /></td>
                <td className={s.tdNum}><input type="text" inputMode="decimal" className={`${s.inputNum} ${s.inputSm}`} value={add.fee} onChange={e => aSet("fee", e.target.value)} placeholder="0" onKeyDown={kbA} /></td>
                <td className={s.tdDelCol} />
              </tr>
            )}

            {/* ── Existing rows ── */}
            {rows.map(row => {
              const aud  = Number(row.amount_aud) || 0;
              const tom  = Number(row.amount_toman) || 0;
              const rate = Number(row.exchange_rate) || (aud > 0 ? tom / aud : 0);
              const fee  = Number(row.fee_aud) || 0;
              const isE  = edit?.id === row.id;
              const isDel = delId === row.id;
              const isEditable = isTradeOrTransfer(row);

              return (
                <tr key={row.id} className={isDel ? s.rowDelete : isE ? s.rowEdit : ""}>
                  <td className={s.tdActions}>
                    {isE && edit ? (
                      <>
                        <div className={s.btnRow}>
                          <button className={s.btnSave} onClick={saveEdit} disabled={isPending}><Check size={12} />{T.save}</button>
                          <button className={s.btnCancel} onClick={() => setEdit(null)}><X size={13} /></button>
                        </div>
                        <ErrLine msg={edit.err} />
                      </>
                    ) : (
                      <div className={s.btnRow}>
                        {isEditable ? <button className={s.btnEdit} onClick={() => startEdit(row)} disabled={busy}><Pencil size={11} />{T.edit}</button> : null}
                      </div>
                    )}
                  </td>

                  <td className={s.tdDateCenter}>
                    {isE && edit ? (
                      <div className={s.dateEditStack}>
                        <div className={s.datePickerWrap}>
                          <CustomDatePicker value={edit.date} onChange={(val) => eSet("date", val)} />
                        </div>
                        <p className={`${s.jalaliLive} ${s.jalaliLiveOverlay}`}>{gregToJalali(edit.date)}</p>
                      </div>
                    ) : (
                      <><p className={s.dateMain}>{storedToJalali(row.date_jalali)}</p><p className={s.dateSub}>{fmtGreg(row.date_gregorian)}</p></>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                      <SelectBox
                        className={s.selectType}
                        labeledOptions={[
                          { value: "buy_aud", label: T.buy },
                          { value: "sell_aud", label: T.sell },
                          { value: "transfer", label: T.transfer },
                        ]}
                        value={edit.type}
                        onChange={(val) => {
                          const nextType = val as any;
                          eSet("type", nextType);
                          if (nextType === "buy_aud") {
                            if (edit.payer_account_id && bankAccounts.find((account) => account.id === edit.payer_account_id)?.currency !== "IRT") {
                              eSet("payer_account_id", "");
                            }
                            if (edit.receiver_account_id && bankAccounts.find((account) => account.id === edit.receiver_account_id)?.currency !== "AUD") {
                              eSet("receiver_account_id", "");
                            }
                          } else if (nextType === "sell_aud") {
                            if (edit.payer_account_id && bankAccounts.find((account) => account.id === edit.payer_account_id)?.currency !== "AUD") {
                              eSet("payer_account_id", "");
                            }
                            if (edit.receiver_account_id && bankAccounts.find((account) => account.id === edit.receiver_account_id)?.currency !== "IRT") {
                              eSet("receiver_account_id", "");
                            }
                          }
                        }}
                      />
                    ) : (
                      <span
                        className={`${tableStyles.badge} ${
                          effectiveEntryType(row) !== "trade"
                            ? tableStyles.badgeArchived
                            : row.type === "buy_aud"
                              ? tableStyles.txBuy
                              : tableStyles.txSell
                        }`}
                        style={{ fontFamily: "var(--font-fa-content)", fontSize: "0.7rem" }}
                      >
                        {rowTypeLabel(row)}
                      </span>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                      <div className={s.fieldStack}>
                        <input type="text" className={s.inputTxt} value={edit.sender} onChange={e => eSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbE} />
                        <input type="text" className={s.inputTxt} value={edit.recipient} onChange={e => eSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbE} />
                      </div>
                    ) : (
                      <div className={s.displayStack}>
                         <span className={s.displayTextStrong}>{row.sender || "—"}</span>
                         <ArrowRight size={10} color="var(--border-med)" style={{ transform: "rotate(90deg)" }} />
                         <span className={s.displayTextStrong}>{row.recipient || "—"}</span>
                      </div>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                       <div className={s.fieldStack}>
                         <SelectBox
                           className={s.selectType}
                           labeledOptions={[
                             { value: "", label: "حساب دریافت کننده..." },
                             ...getLedgerAccountOptions(edit.type, "receiver"),
                           ]}
                           value={edit.receiver_account_id}
                           onChange={(val) => eSet("receiver_account_id", val)}
                         />
                         <SelectBox
                           className={s.selectType}
                           labeledOptions={[
                             { value: "", label: "حساب پرداخت کننده..." },
                             ...getLedgerAccountOptions(edit.type, "payer"),
                           ]}
                           value={edit.payer_account_id}
                           onChange={(val) => eSet("payer_account_id", val)}
                         />
                       </div>
                    ) : (
                      <div className={s.displayStack}>
                         <span className={s.displayTextAccent}>{getAccountName(row.receiver_account_id)}</span>
                         <ArrowRight size={10} color="var(--border-med)" style={{ transform: "rotate(90deg)" }} />
                         <span className={s.displayTextAccent}>{getAccountName(row.payer_account_id)}</span>
                      </div>
                    )}
                  </td>

                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.rate} onChange={e => eSet("rate", e.target.value)} onKeyDown={kbE} /> : <span className={s.numRate}>{rate > 0 ? fmtRate(rate) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.aud} onChange={e => eSet("aud", e.target.value)} onKeyDown={kbE} /> : <span className={s.numAud}>{aud > 0 ? fmtAUD(aud) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.toman} onChange={e => eSet("toman", e.target.value)} onKeyDown={kbE} /> : <span className={s.numToman}>{tom > 0 ? fmtIRT(tom) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.inputSm}`} value={edit.fee} onChange={e => eSet("fee", e.target.value)} onKeyDown={kbE} /> : fee > 0 ? <span className={s.numFee}>{fee} AUD</span> : <span className={s.dim}>&mdash;</span>}</td>
                  
                  <td className={s.tdDelCol}>
                    {!isEditable ? null : isDel ? (
                      <div className={s.delInline}>
                        <p className={s.delConfirmLabel}>{T.delConfirm}</p>
                        <div className={s.btnRow}>
                          <button className={s.btnConfirmDel} onClick={() => doDelete(row.id)} disabled={isPending}><Check size={11} /></button>
                          <button className={s.btnCancel} onClick={() => setDelId(null)}><X size={12} /></button>
                        </div>
                      </div>
                    ) : (
                      <button className={s.btnDel} onClick={() => { setDelId(row.id); setEdit(null); setAdd(null); }} disabled={busy}><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        <div className={s.mobileOnly}>
          {add && (
            <section className={`${s.mobileCard} ${s.mobileCardAdd}`}>
              <header className={s.mobileCardHeader}>
                <h3 className={s.mobileCardTitle}>{T.addRow}</h3>
                <div className={s.btnRow}>
                  <button className={s.btnSave} onClick={saveAdd} disabled={isPending}><Check size={12} />{T.save}</button>
                  <button className={s.btnCancel} onClick={() => setAdd(null)}><X size={13} /></button>
                </div>
              </header>

              <div className={s.mobileFieldGrid}>
                <label className={s.mobileFieldLabel}>{T.colDate}</label>
                <div>
                  <CustomDatePicker value={add.date} onChange={(val) => aSet("date", val)} />
                  <p className={s.jalaliLive}>{gregToJalali(add.date)}</p>
                </div>

                <label className={s.mobileFieldLabel}>{T.colType}</label>
                <SelectBox
                  className={s.selectType}
                  labeledOptions={[
                    { value: "buy_aud", label: T.buy },
                    { value: "sell_aud", label: T.sell },
                    { value: "transfer", label: T.transfer },
                  ]}
                  value={add.type}
                  onChange={(val) => {
                    const nextType = val as any;
                    aSet("type", nextType);
                    if (nextType === "buy_aud") {
                      if (add.payer_account_id && bankAccounts.find((account) => account.id === add.payer_account_id)?.currency !== "IRT") {
                        aSet("payer_account_id", "");
                      }
                      if (add.receiver_account_id && bankAccounts.find((account) => account.id === add.receiver_account_id)?.currency !== "AUD") {
                        aSet("receiver_account_id", "");
                      }
                    } else if (nextType === "sell_aud") {
                      if (add.payer_account_id && bankAccounts.find((account) => account.id === add.payer_account_id)?.currency !== "AUD") {
                        aSet("payer_account_id", "");
                      }
                      if (add.receiver_account_id && bankAccounts.find((account) => account.id === add.receiver_account_id)?.currency !== "IRT") {
                        aSet("receiver_account_id", "");
                      }
                    }
                  }}
                />

                <label className={s.mobileFieldLabel}>{T.colCustomers}</label>
                <div className={s.fieldStack}>
                      <input type="text" className={s.inputTxt} value={add.sender} onChange={e => aSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbA} />
                      <input type="text" className={s.inputTxt} value={add.recipient} onChange={e => aSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbA} />
                </div>

                <label className={s.mobileFieldLabel}>{T.colPockets}</label>
                <div className={s.fieldStack}>
                  <SelectBox
                    className={s.selectType}
                    labeledOptions={[
                      { value: "", label: "حساب دریافت کننده..." },
                      ...getLedgerAccountOptions(add.type, "receiver"),
                    ]}
                    value={add.receiver_account_id}
                    onChange={(val) => aSet("receiver_account_id", val)}
                  />
                  <SelectBox
                    className={s.selectType}
                    labeledOptions={[
                      { value: "", label: "حساب پرداخت کننده..." },
                      ...getLedgerAccountOptions(add.type, "payer"),
                    ]}
                    value={add.payer_account_id}
                    onChange={(val) => aSet("payer_account_id", val)}
                  />
                </div>

                <label className={s.mobileFieldLabel}>{T.colRate}</label>
                <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={add.rate} onChange={e => aSet("rate", e.target.value)} placeholder="0" onKeyDown={kbA} />

                <label className={s.mobileFieldLabel}>{T.colAud}</label>
                <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={add.aud} onChange={e => aSet("aud", e.target.value)} placeholder="0.00" onKeyDown={kbA} />

                <label className={s.mobileFieldLabel}>{T.colToman}</label>
                <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={add.toman} onChange={e => aSet("toman", e.target.value)} placeholder="0" onKeyDown={kbA} />

                <label className={s.mobileFieldLabel}>{T.colFee}</label>
                <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={add.fee} onChange={e => aSet("fee", e.target.value)} placeholder="0" onKeyDown={kbA} />
              </div>
              <ErrLine msg={add.err} />
            </section>
          )}

          {rows.map(row => {
            const aud = Number(row.amount_aud) || 0;
            const tom = Number(row.amount_toman) || 0;
            const rate = Number(row.exchange_rate) || (aud > 0 ? tom / aud : 0);
            const fee = Number(row.fee_aud) || 0;
            const isE = edit?.id === row.id;
            const isDel = delId === row.id;
            const isEditable = isTradeOrTransfer(row);

            return (
              <section key={`mobile-${row.id}`} className={`${s.mobileCard} ${isE ? s.mobileCardEdit : ""} ${isDel ? s.mobileCardDelete : ""}`}>
                <header className={s.mobileCardHeader}>
                  <div>
                    <h3 className={s.mobileCardTitle}>{rowTypeLabel(row)}</h3>
                    <p className={s.mobileCardDate}>{storedToJalali(row.date_jalali)} | {fmtGreg(row.date_gregorian)}</p>
                  </div>

                  {isE ? (
                    <div className={s.btnRow}>
                      <button className={s.btnSave} onClick={saveEdit} disabled={isPending}><Check size={12} />{T.save}</button>
                      <button className={s.btnCancel} onClick={() => setEdit(null)}><X size={13} /></button>
                    </div>
                  ) : isDel ? (
                    <div className={s.btnRow}>
                      <button className={s.btnConfirmDel} onClick={() => doDelete(row.id)} disabled={isPending}><Check size={11} /></button>
                      <button className={s.btnCancel} onClick={() => setDelId(null)}><X size={12} /></button>
                    </div>
                  ) : isEditable ? (
                    <div className={s.btnRow}>
                      <button className={s.btnEdit} onClick={() => startEdit(row)} disabled={busy}><Pencil size={11} />{T.edit}</button>
                      <button className={s.btnDel} onClick={() => { setDelId(row.id); setEdit(null); setAdd(null); }} disabled={busy}><Trash2 size={13} /></button>
                    </div>
                  ) : null}
                </header>

                {isE && edit ? (
                  <div className={s.mobileFieldGrid}>
                    <label className={s.mobileFieldLabel}>{T.colDate}</label>
                    <div>
                      <CustomDatePicker value={edit.date} onChange={(val) => eSet("date", val)} />
                      <p className={s.jalaliLive}>{gregToJalali(edit.date)}</p>
                    </div>

                    <label className={s.mobileFieldLabel}>{T.colType}</label>
                    <SelectBox
                      className={s.selectType}
                      labeledOptions={[
                        { value: "buy_aud", label: T.buy },
                        { value: "sell_aud", label: T.sell },
                        { value: "transfer", label: T.transfer },
                      ]}
                      value={edit.type}
                      onChange={(val) => {
                        const nextType = val as any;
                        eSet("type", nextType);
                        if (nextType === "buy_aud") {
                          if (edit.payer_account_id && bankAccounts.find((account) => account.id === edit.payer_account_id)?.currency !== "IRT") {
                            eSet("payer_account_id", "");
                          }
                          if (edit.receiver_account_id && bankAccounts.find((account) => account.id === edit.receiver_account_id)?.currency !== "AUD") {
                            eSet("receiver_account_id", "");
                          }
                        } else if (nextType === "sell_aud") {
                          if (edit.payer_account_id && bankAccounts.find((account) => account.id === edit.payer_account_id)?.currency !== "AUD") {
                            eSet("payer_account_id", "");
                          }
                          if (edit.receiver_account_id && bankAccounts.find((account) => account.id === edit.receiver_account_id)?.currency !== "IRT") {
                            eSet("receiver_account_id", "");
                          }
                        }
                      }}
                    />

                    <label className={s.mobileFieldLabel}>{T.colCustomers}</label>
                    <div className={s.fieldStack}>
                      <input type="text" className={s.inputTxt} value={edit.sender} onChange={e => eSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbE} />
                      <input type="text" className={s.inputTxt} value={edit.recipient} onChange={e => eSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbE} />
                    </div>

                    <label className={s.mobileFieldLabel}>{T.colPockets}</label>
                    <div className={s.fieldStack}>
                      <SelectBox
                        className={s.selectType}
                        labeledOptions={[
                          { value: "", label: "حساب دریافت کننده..." },
                          ...getLedgerAccountOptions(edit.type, "receiver"),
                        ]}
                        value={edit.receiver_account_id}
                        onChange={(val) => eSet("receiver_account_id", val)}
                      />
                      <SelectBox
                        className={s.selectType}
                        labeledOptions={[
                          { value: "", label: "حساب پرداخت کننده..." },
                          ...getLedgerAccountOptions(edit.type, "payer"),
                        ]}
                        value={edit.payer_account_id}
                        onChange={(val) => eSet("payer_account_id", val)}
                      />
                    </div>

                    <label className={s.mobileFieldLabel}>{T.colRate}</label>
                    <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={edit.rate} onChange={e => eSet("rate", e.target.value)} onKeyDown={kbE} />

                    <label className={s.mobileFieldLabel}>{T.colAud}</label>
                    <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={edit.aud} onChange={e => eSet("aud", e.target.value)} onKeyDown={kbE} />

                    <label className={s.mobileFieldLabel}>{T.colToman}</label>
                    <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={edit.toman} onChange={e => eSet("toman", e.target.value)} onKeyDown={kbE} />

                    <label className={s.mobileFieldLabel}>{T.colFee}</label>
                    <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.mobileInputWide}`} value={edit.fee} onChange={e => eSet("fee", e.target.value)} onKeyDown={kbE} />
                  </div>
                ) : (
                  <dl className={s.mobileSummaryGrid}>
                    <dt>{T.colCustomers}</dt>
                    <dd>{row.recipient || "-"} | {row.sender || "-"}</dd>
                    <dt>{T.colPockets}</dt>
                    <dd>{getAccountName(row.receiver_account_id)} | {getAccountName(row.payer_account_id)}</dd>
                    <dt>{T.colRate}</dt>
                    <dd>{rate > 0 ? fmtRate(rate) : "-"}</dd>
                    <dt>{T.colAud}</dt>
                    <dd>{aud > 0 ? fmtAUD(aud) : "-"}</dd>
                    <dt>{T.colToman}</dt>
                    <dd>{tom > 0 ? fmtIRT(tom) : "-"}</dd>
                    <dt>{T.colFee}</dt>
                    <dd>{fee > 0 ? `${fee} AUD` : "-"}</dd>
                  </dl>
                )}

                {isE && <ErrLine msg={edit?.err || null} />}
                {isDel && <p className={s.delConfirmLabel}>{T.delConfirm}</p>}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}