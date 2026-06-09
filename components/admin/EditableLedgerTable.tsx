"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";
import { updateLedgerEntry, addManualLedgerEntry, deleteLedgerEntry } from "@/app/actions/admin.actions";
import tableStyles from "@/styles/admin/AdminTable.module.css";
import s from "@/styles/admin/LedgerTable.module.css";

// -- Persian strings (unicode-escaped for PowerShell safety) ----------------
const T = {
  buy:        "\u062e\u0631\u06cc\u062f",
  sell:       "\u0641\u0631\u0648\u0634",
  kadoos:     "\u06a9\u0627\u062f\u0648\u0633",
  zarman:     "\u0632\u0631\u0645\u0627\u0646",
  addRow:     "\u0627\u0641\u0632\u0648\u062f\u0646 \u0633\u0637\u0631",
  save:       "\u0630\u062e\u06cc\u0631\u0647",
  cancel:     "\u0644\u063a\u0648",
  edit:       "\u0648\u06cc\u0631\u0627\u06cc\u0634",
  del:        "\u062d\u0630\u0641",
  delConfirm: "\u062d\u0630\u0641 \u0634\u0648\u062f\u061f",
  colDate:    "\u062a\u0627\u0631\u06cc\u062e",
  colType:    "\u0646\u0648\u0639",
  colPayer:   "\u067e\u0631\u062f\u0627\u062e\u062a \u06a9\u0646\u0646\u062f\u0647",
  colRate:    "\u0646\u0631\u062e",
  colAud:     "AUD ($)",
  colToman:   "Toman (IRT)",
  colSender:  "\u0641\u0631\u0633\u062a\u0646\u062f\u0647",
  colRecip:   "\u06af\u06cc\u0631\u0646\u062f\u0647",
  colFee:     "\u06a9\u0627\u0631\u0645\u0632\u062f",
  colActions: "\u0639\u0645\u0644\u06cc\u0627\u062a",
  colDel:     "\u062d\u0630\u0641",
  errAud:     "\u0645\u0628\u0644\u063a \u062f\u0644\u0627\u0631 \u0646\u0627\u0645\u0639\u062a\u0628\u0631",
  errToman:   "\u0645\u0628\u0644\u063a \u062a\u0648\u0645\u0627\u0646 \u0646\u0627\u0645\u0639\u062a\u0628\u0631",
  errFee:     "\u06a9\u0627\u0631\u0645\u0632\u062f \u0646\u0627\u0645\u0639\u062a\u0628\u0631",
  phSender:   "\u0641\u0631\u0633\u062a\u0646\u062f\u0647",
  phRecip:    "\u06af\u06cc\u0631\u0646\u062f\u0647",
  months: [
    "\u0641\u0631\u0648\u0631\u062f\u06cc\u0646", "\u0627\u0631\u062f\u06cc\u0628\u0647\u0634\u062a", "\u062e\u0631\u062f\u0627\u062f",
    "\u062a\u06cc\u0631", "\u0645\u0631\u062f\u0627\u062f", "\u0634\u0647\u0631\u06cc\u0648\u0631",
    "\u0645\u0647\u0631", "\u0622\u0628\u0627\u0646", "\u0622\u0630\u0631",
    "\u062f\u06cc", "\u0628\u0647\u0645\u0646", "\u0627\u0633\u0641\u0646\u062f",
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
  if (!yyyymmdd) return "\u2014";
  const parts = yyyymmdd.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "\u2014";
  const [jy, jm, jd] = toJalali(parts[0], parts[1], parts[2]);
  if (jm < 1 || jm > 12) return "\u2014";
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
  exchange_rate: number | string;
  amount_aud: number | string;
  amount_toman: number | string;
  sender: string;
  recipient: string;
  fee_aud: number | string;
  notes: string | null;
};
interface Props { rows: LedgerRow[] }

type EditState = {
  id: string; date: string; type: "buy_aud" | "sell_aud";
  rate: string; aud: string; toman: string;
  sender: string; recipient: string; fee: string; err: string | null;
};
type AddState = {
  date: string; type: "buy_aud" | "sell_aud";
  rate: string; aud: string; toman: string;
  sender: string; recipient: string; fee: string; err: string | null;
};

const emptyAdd = (): AddState => ({
  date: today(), type: "buy_aud",
  rate: "", aud: "", toman: "", sender: "", recipient: "", fee: "", err: null,
});

// -- Shared header cell styles ----------------------------------------------
const TH_FA: React.CSSProperties = { textAlign: "center", fontFamily: "var(--font-fa-content)", direction: "rtl", padding: "0.8rem 0.6rem", whiteSpace: "nowrap" };
const TH_EN: React.CSSProperties = { textAlign: "right",  fontFamily: "var(--font-en-stack)",   direction: "ltr", padding: "0.8rem 0.8rem", whiteSpace: "nowrap" };

// -- Add button (exported so the page can render it in the panel header) ----
export function LedgerAddButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button className={s.addBtn} onClick={onClick} disabled={disabled}>
      <Plus size={14} />{T.addRow}
    </button>
  );
}

// -- Component --------------------------------------------------------------
export function EditableLedgerTable({ rows }: Props) {
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
      type: row.type === "sell_aud" ? "sell_aud" : "buy_aud",
      rate: Number(row.exchange_rate) > 0
        ? String(Math.round(Number(row.exchange_rate)))
        : aud > 0 ? String(Math.round(tom / aud)) : "",
      aud: String(aud), toman: String(tom),
      sender: row.sender ?? "", recipient: row.recipient ?? "",
      fee: Number(row.fee_aud) > 0 ? String(Number(row.fee_aud)) : "", err: null,
    });
    setAdd(null); setDelId(null);
  };

  const parseF = (s: string) => parseFloat(s.replace(/,/g, ""));

  const saveEdit = () => {
    if (!edit) return;
    const aud = parseF(edit.aud), tom = parseF(edit.toman), rate = parseF(edit.rate), fee = edit.fee.trim() ? parseF(edit.fee) : 0;
    if (!Number.isFinite(aud)  || aud  <= 0) { setEdit({ ...edit, err: T.errAud });   return; }
    if (!Number.isFinite(tom)  || tom  <= 0) { setEdit({ ...edit, err: T.errToman }); return; }
    if (!Number.isFinite(fee)  || fee  <  0) { setEdit({ ...edit, err: T.errFee });   return; }
    setEdit({ ...edit, err: null });
    start(async () => {
      const res = await updateLedgerEntry(edit.id, {
        date_gregorian: edit.date || undefined, type: edit.type,
        exchange_rate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
        amount_aud: aud, amount_toman: tom, sender: edit.sender, recipient: edit.recipient, fee_aud: fee,
      });
      if ("error" in res) setEdit(e => e ? { ...e, err: res.error } : null);
      else { setEdit(null); router.refresh(); }
    });
  };

  const saveAdd = () => {
    if (!add) return;
    const aud = parseF(add.aud), tom = parseF(add.toman), rate = parseF(add.rate), fee = add.fee.trim() ? parseF(add.fee) : 0;
    if (!Number.isFinite(aud)  || aud  <= 0) { setAdd({ ...add, err: T.errAud });   return; }
    if (!Number.isFinite(tom)  || tom  <= 0) { setAdd({ ...add, err: T.errToman }); return; }
    if (!Number.isFinite(fee)  || fee  <  0) { setAdd({ ...add, err: T.errFee });   return; }
    setAdd({ ...add, err: null });
    start(async () => {
      const res = await addManualLedgerEntry({
        type: add.type, amountAud: aud, amountToman: tom,
        exchangeRate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
        sender: add.sender || undefined, recipient: add.recipient || undefined,
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

  const openAdd = () => { setAdd(emptyAdd()); setEdit(null); setDelId(null); };

  const kbE = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEdit(null); };
  const kbA = (e: React.KeyboardEvent) => { if (e.key === "Enter") saveAdd();  if (e.key === "Escape") setAdd(null); };
  const busy = isPending || !!edit || !!add || !!delId;

  const ErrLine = ({ msg }: { msg: string | null }) =>
    msg ? <p className={s.errLine}>{msg}</p> : null;

  return (
    <div>
      {/* Toolbar: Add button sits at the left (LTR end) of the panel header area */}
      <div className={s.toolbar}>
        <button className={s.addBtn} onClick={openAdd} disabled={!!add || isPending}>
          <Plus size={14} />{T.addRow}
        </button>
      </div>

      <div className={tableStyles.tableWrap}>
        <table className={tableStyles.table} dir="rtl">
          <thead>
            <tr>
              {/* Actions (edit only) */}
              <th style={{ ...TH_FA, width: 100 }}>{T.colActions}</th>
              {/* Date — centered */}
              <th style={{ ...TH_FA, textAlign: "center" }}>{T.colDate}</th>
              <th style={{ ...TH_FA, width: 80 }}>{T.colType}</th>
              <th style={TH_FA}>{T.colPayer}</th>
              <th style={TH_EN}>{T.colRate}</th>
              <th style={TH_EN}>{T.colAud}</th>
              <th style={TH_EN}>{T.colToman}</th>
              <th style={TH_FA}>{T.colSender}</th>
              <th style={TH_FA}>{T.colRecip}</th>
              <th style={TH_EN}>{T.colFee}</th>
              {/* Delete — last column */}
              <th style={{ ...TH_FA, width: 56 }}>{T.colDel}</th>
            </tr>
          </thead>
          <tbody>

            {/* ── Add row ── */}
            {add && (
              <tr className={s.rowAdd}>
                {/* Actions: save/cancel */}
                <td className={s.tdActions}>
                  <div className={s.btnRow}>
                    <button className={s.btnSave} onClick={saveAdd} disabled={isPending}>
                      <Check size={12} />{T.save}
                    </button>
                    <button className={s.btnCancel} onClick={() => setAdd(null)}>
                      <X size={13} />
                    </button>
                  </div>
                  <ErrLine msg={add.err} />
                </td>
                {/* Date — centered */}
                <td className={s.tdDateCenter}>
                  <input type="date" className={s.inputDate} value={add.date}
                    onChange={e => aSet("date", e.target.value)} onKeyDown={kbA} />
                  <p className={s.jalaliLive}>{gregToJalali(add.date)}</p>
                </td>
                <td className={s.tdCenter}>
                  <select className={s.selectType} value={add.type}
                    onChange={e => aSet("type", e.target.value as "buy_aud" | "sell_aud")}>
                    <option value="buy_aud">{T.buy}</option>
                    <option value="sell_aud">{T.sell}</option>
                  </select>
                </td>
                <td className={s.tdCenter}>
                  <span className={s.payerName}>{add.type === "buy_aud" ? T.kadoos : T.zarman}</span>
                </td>
                <td className={s.tdNum}>
                  <input type="text" inputMode="decimal" className={s.inputNum}
                    value={add.rate} onChange={e => aSet("rate", e.target.value)} placeholder="0" onKeyDown={kbA} />
                </td>
                <td className={s.tdNum}>
                  <input type="text" inputMode="decimal" className={s.inputNum}
                    value={add.aud} onChange={e => aSet("aud", e.target.value)} placeholder="0.00" autoFocus onKeyDown={kbA} />
                </td>
                <td className={s.tdNum}>
                  <input type="text" inputMode="decimal" className={s.inputNum}
                    value={add.toman} onChange={e => aSet("toman", e.target.value)} placeholder="0" onKeyDown={kbA} />
                </td>
                <td className={s.tdPerson}>
                  <input type="text" className={s.inputTxt}
                    value={add.sender} onChange={e => aSet("sender", e.target.value)} placeholder={T.phSender} onKeyDown={kbA} />
                </td>
                <td className={s.tdPerson}>
                  <input type="text" className={s.inputTxt}
                    value={add.recipient} onChange={e => aSet("recipient", e.target.value)} placeholder={T.phRecip} onKeyDown={kbA} />
                </td>
                <td className={s.tdNum}>
                  <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.inputSm}`}
                    value={add.fee} onChange={e => aSet("fee", e.target.value)} placeholder="0" onKeyDown={kbA} />
                </td>
                {/* Delete col — empty for add row */}
                <td className={s.tdDelCol} />
              </tr>
            )}

            {/* ── Existing rows ── */}
            {rows.map(row => {
              const aud  = Number(row.amount_aud);
              const tom  = Number(row.amount_toman);
              const rate = Number(row.exchange_rate) || (aud > 0 ? tom / aud : 0);
              const fee  = Number(row.fee_aud);
              const isBuy = row.type === "buy_aud";
              const isE   = edit?.id === row.id;
              const isDel = delId === row.id;

              const rowCls = isDel ? s.rowDelete : isE ? s.rowEdit : "";

              return (
                <tr key={row.id} className={rowCls}>

                  {/* Actions — edit / save+cancel only */}
                  <td className={s.tdActions}>
                    {isE && edit ? (
                      <>
                        <div className={s.btnRow}>
                          <button className={s.btnSave} onClick={saveEdit} disabled={isPending}>
                            <Check size={12} />{T.save}
                          </button>
                          <button className={s.btnCancel} onClick={() => setEdit(null)}>
                            <X size={13} />
                          </button>
                        </div>
                        <ErrLine msg={edit.err} />
                      </>
                    ) : (
                      <div className={s.btnRow}>
                        <button className={s.btnEdit} onClick={() => startEdit(row)} disabled={busy}>
                          <Pencil size={11} />{T.edit}
                        </button>
                      </div>
                    )}
                  </td>

                  {/* Date — centered, Jalali + Gregorian sub */}
                  <td className={s.tdDateCenter}>
                    {isE && edit ? (
                      <>
                        <input type="date" className={s.inputDate}
                          value={edit.date} onChange={e => eSet("date", e.target.value)} onKeyDown={kbE} />
                        <p className={s.jalaliLive}>{gregToJalali(edit.date)}</p>
                      </>
                    ) : (
                      <>
                        <p className={s.dateMain}>{storedToJalali(row.date_jalali)}</p>
                        <p className={s.dateSub}>{fmtGreg(row.date_gregorian)}</p>
                      </>
                    )}
                  </td>

                  {/* Type */}
                  <td className={s.tdCenter}>
                    {isE && edit ? (
                      <select className={s.selectType} value={edit.type}
                        onChange={e => eSet("type", e.target.value as "buy_aud" | "sell_aud")}>
                        <option value="buy_aud">{T.buy}</option>
                        <option value="sell_aud">{T.sell}</option>
                      </select>
                    ) : (
                      <span className={`${tableStyles.badge} ${isBuy ? tableStyles.txBuy : tableStyles.txSell}`}
                        style={{ fontFamily: "var(--font-fa-content)", fontSize: "0.7rem" }}>
                        {isBuy ? T.buy : T.sell}
                      </span>
                    )}
                  </td>

                  {/* Payer */}
                  <td className={s.tdCenter}>
                    <span className={s.payerName}>
                      {isE && edit ? (edit.type === "buy_aud" ? T.kadoos : T.zarman) : (isBuy ? T.kadoos : T.zarman)}
                    </span>
                  </td>

                  {/* Rate */}
                  <td className={s.tdNum}>
                    {isE && edit
                      ? <input type="text" inputMode="decimal" className={s.inputNum}
                          value={edit.rate} onChange={e => eSet("rate", e.target.value)} onKeyDown={kbE} />
                      : <span className={s.numRate}>{fmtRate(rate)}</span>
                    }
                  </td>

                  {/* AUD */}
                  <td className={s.tdNum}>
                    {isE && edit
                      ? <input type="text" inputMode="decimal" className={s.inputNum}
                          value={edit.aud} onChange={e => eSet("aud", e.target.value)} onKeyDown={kbE} />
                      : <span className={s.numAud}>{fmtAUD(aud)}</span>
                    }
                  </td>

                  {/* Toman */}
                  <td className={s.tdNum}>
                    {isE && edit
                      ? <input type="text" inputMode="decimal" className={s.inputNum}
                          value={edit.toman} onChange={e => eSet("toman", e.target.value)} onKeyDown={kbE} />
                      : <span className={s.numToman}>{fmtIRT(tom)}</span>
                    }
                  </td>

                  {/* Sender */}
                  <td className={s.tdPerson}>
                    {isE && edit
                      ? <input type="text" className={s.inputTxt}
                          value={edit.sender} onChange={e => eSet("sender", e.target.value)} placeholder={T.phSender} onKeyDown={kbE} />
                      : <span className={s.personName}>{row.sender || "\u2014"}</span>
                    }
                  </td>

                  {/* Recipient */}
                  <td className={s.tdPerson}>
                    {isE && edit
                      ? <input type="text" className={s.inputTxt}
                          value={edit.recipient} onChange={e => eSet("recipient", e.target.value)} placeholder={T.phRecip} onKeyDown={kbE} />
                      : <span className={s.personName}>{row.recipient || "\u2014"}</span>
                    }
                  </td>

                  {/* Fee */}
                  <td className={s.tdNum}>
                    {isE && edit
                      ? <input type="text" inputMode="decimal" className={`${s.inputNum} ${s.inputSm}`}
                          value={edit.fee} onChange={e => eSet("fee", e.target.value)} placeholder="0" onKeyDown={kbE} />
                      : fee > 0
                        ? <span className={s.numFee}>{fee} AUD</span>
                        : <span className={s.dim}>&mdash;</span>
                    }
                  </td>

                  {/* Delete — last column */}
                  <td className={s.tdDelCol}>
                    {isDel ? (
                      <div className={s.delInline}>
                        <p className={s.delConfirmLabel}>{T.delConfirm}</p>
                        <div className={s.btnRow}>
                          <button className={s.btnConfirmDel} onClick={() => doDelete(row.id)} disabled={isPending}>
                            <Check size={11} />
                          </button>
                          <button className={s.btnCancel} onClick={() => setDelId(null)}>
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={s.btnDel}
                        onClick={() => { setDelId(row.id); setEdit(null); setAdd(null); }}
                        disabled={busy}
                      >
                        <Trash2 size={13} />
                      </button>
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
