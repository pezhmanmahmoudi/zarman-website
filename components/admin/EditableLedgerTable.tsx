"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2, ArrowRight } from "lucide-react";
import { updateLedgerEntry, addManualLedgerEntry, deleteLedgerEntry } from "@/app/actions/admin.actions";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import s from "@/styles/admin/LedgerTable.module.css";

// -- Persian strings ----------------
const T = {
  buy:        "خرید",
  sell:       "فروش",
  transfer:   "انتقال",
  addRow:     "افزودن سطر",
  save:       "ذخیره",
  cancel:     "لغو",
  edit:       "ویرایش",
  del:        "حذف",
  delConfirm: "حذف شود؟",
  colDate:    "تاریخ",
  colType:    "نوع",
  colPockets: "مسیر داخلی (مبدأ ⬅ مقصد)",
  colCustomers: "طرف حساب (فرستنده ⬅ گیرنده)",
  colRate:    "نرخ",
  colAud:     "AUD ($)",
  colToman:   "Toman (IRT)",
  colFee:     "کارمزد",
  colActions: "عملیات",
  colDel:     "حذف",
  errAmount:  "حداقل یکی از مبالغ دلار یا تومان باید بیشتر از صفر باشد.",
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
export function EditableLedgerTable({ rows, bankAccounts }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [edit,    setEdit]    = useState<EditState | null>(null);
  const [add,     setAdd]     = useState<AddState  | null>(null);
  const [delId,   setDelId]   = useState<string    | null>(null);

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

  const openAdd = () => { setAdd(emptyAdd()); setEdit(null); setDelId(null); };

  const kbE = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEdit(null); };
  const kbA = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveAdd();  if (e.key === "Escape") setAdd(null); };
  const busy = isPending || !!edit || !!add || !!delId;

  const ErrLine = ({ msg }: { msg: string | null }) => msg ? <p className={s.errLine}>{msg}</p> : null;

  return (
    <div>
      <div className={s.toolbar}>
        <button className={s.addBtn} onClick={openAdd} disabled={!!add || isPending}>
          <Plus size={14} />{T.addRow}
        </button>
      </div>

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table} dir="rtl" style={{ minWidth: "1000px" }}>
          <thead>
            <tr>
              <th style={{ ...TH_FA, width: 80 }}>{T.colActions}</th>
              <th style={{ ...TH_FA, textAlign: "center" }}>{T.colDate}</th>
              <th style={{ ...TH_FA, width: 80 }}>{T.colType}</th>
              <th style={{ ...TH_FA }}>{T.colCustomers}</th>
              <th style={{ ...TH_FA }}>{T.colPockets}</th>
              <th style={TH_EN}>{T.colRate}</th>
              <th style={TH_EN}>{T.colAud}</th>
              <th style={TH_EN}>{T.colToman}</th>
              <th style={TH_EN}>{T.colFee}</th>
              <th style={{ ...TH_FA, width: 56 }}>{T.colDel}</th>
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
                  <input type="date" className={s.inputDate} value={add.date} onChange={e => aSet("date", e.target.value)} onKeyDown={kbA} />
                  <p className={s.jalaliLive}>{gregToJalali(add.date)}</p>
                </td>
                <td className={s.tdCenter}>
                  <select className={s.selectType} value={add.type} onChange={e => aSet("type", e.target.value as any)}>
                    <option value="buy_aud">{T.buy}</option>
                    <option value="sell_aud">{T.sell}</option>
                    <option value="transfer">{T.transfer}</option>
                  </select>
                </td>
                <td className={s.tdCenter}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <input type="text" className={s.inputTxt} value={add.sender} onChange={e => aSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbA} style={{ fontSize: "0.75rem", padding: "4px" }} />
                    <input type="text" className={s.inputTxt} value={add.recipient} onChange={e => aSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbA} style={{ fontSize: "0.75rem", padding: "4px" }} />
                  </div>
                </td>
                <td className={s.tdCenter}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <select className={s.selectType} value={add.payer_account_id} onChange={e => aSet("payer_account_id", e.target.value)} style={{ fontSize: "0.75rem", padding: "2px" }}>
                      <option value="">حساب پرداخت کننده...</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
                    </select>
                    <select className={s.selectType} value={add.receiver_account_id} onChange={e => aSet("receiver_account_id", e.target.value)} style={{ fontSize: "0.75rem", padding: "2px" }}>
                      <option value="">حساب دریافت کننده...</option>
                      {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
                    </select>
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
                        <button className={s.btnEdit} onClick={() => startEdit(row)} disabled={busy}><Pencil size={11} />{T.edit}</button>
                      </div>
                    )}
                  </td>

                  <td className={s.tdDateCenter}>
                    {isE && edit ? (
                      <><input type="date" className={s.inputDate} value={edit.date} onChange={e => eSet("date", e.target.value)} onKeyDown={kbE} />
                      <p className={s.jalaliLive}>{gregToJalali(edit.date)}</p></>
                    ) : (
                      <><p className={s.dateMain}>{storedToJalali(row.date_jalali)}</p><p className={s.dateSub}>{fmtGreg(row.date_gregorian)}</p></>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                      <select className={s.selectType} value={edit.type} onChange={e => eSet("type", e.target.value as any)}>
                        <option value="buy_aud">{T.buy}</option>
                        <option value="sell_aud">{T.sell}</option>
                        <option value="transfer">{T.transfer}</option>
                      </select>
                    ) : (
                      <span className={`${tableStyles.badge} ${row.type === "buy_aud" ? tableStyles.txBuy : tableStyles.txSell}`} style={{ fontFamily: "var(--font-fa-content)", fontSize: "0.7rem" }}>
                        {row.type === "buy_aud" ? T.buy : row.entry_type === "transfer" ? T.transfer : T.sell}
                      </span>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <input type="text" className={s.inputTxt} value={edit.sender} onChange={e => eSet("sender", e.target.value)} placeholder="فرستنده..." onKeyDown={kbE} style={{ fontSize: "0.75rem", padding: "4px" }} />
                        <input type="text" className={s.inputTxt} value={edit.recipient} onChange={e => eSet("recipient", e.target.value)} placeholder="گیرنده..." onKeyDown={kbE} style={{ fontSize: "0.75rem", padding: "4px" }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                         <span style={{ fontWeight: 600 }}>{row.sender || "—"}</span>
                         <ArrowRight size={10} color="var(--border-med)" style={{ transform: "rotate(90deg)" }} />
                         <span style={{ fontWeight: 600 }}>{row.recipient || "—"}</span>
                      </div>
                    )}
                  </td>

                  <td className={s.tdCenter}>
                    {isE && edit ? (
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <select className={s.selectType} value={edit.payer_account_id} onChange={e => eSet("payer_account_id", e.target.value)} style={{ fontSize: "0.75rem", padding: "2px" }}>
                           <option value="">حساب پرداخت کننده...</option>
                           {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
                         </select>
                         <select className={s.selectType} value={edit.receiver_account_id} onChange={e => eSet("receiver_account_id", e.target.value)} style={{ fontSize: "0.75rem", padding: "2px" }}>
                           <option value="">حساب دریافت کننده...</option>
                           {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
                         </select>
                       </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-soft)' }}>
                         <span style={{ fontWeight: 600, color: "var(--accent)" }}>{getAccountName(row.payer_account_id)}</span>
                         <ArrowRight size={10} color="var(--border-med)" style={{ transform: "rotate(90deg)" }} />
                         <span style={{ fontWeight: 600, color: "var(--accent)" }}>{getAccountName(row.receiver_account_id)}</span>
                      </div>
                    )}
                  </td>

                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.rate} onChange={e => eSet("rate", e.target.value)} onKeyDown={kbE} /> : <span className={s.numRate}>{rate > 0 ? fmtRate(rate) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.aud} onChange={e => eSet("aud", e.target.value)} onKeyDown={kbE} /> : <span className={s.numAud}>{aud > 0 ? fmtAUD(aud) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={s.inputNum} value={edit.toman} onChange={e => eSet("toman", e.target.value)} onKeyDown={kbE} /> : <span className={s.numToman}>{tom > 0 ? fmtIRT(tom) : "—"}</span>}</td>
                  <td className={s.tdNum}>{isE && edit ? <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.inputSm}`} value={edit.fee} onChange={e => eSet("fee", e.target.value)} onKeyDown={kbE} /> : fee > 0 ? <span className={s.numFee}>{fee} AUD</span> : <span className={s.dim}>&mdash;</span>}</td>
                  
                  <td className={s.tdDelCol}>
                    {isDel ? (
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
    </div>
  );
}