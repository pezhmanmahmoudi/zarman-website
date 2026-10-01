"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { getAdminPaymentAccount } from "@/app/actions/request.actions";
import type { PaymentAccountAccess } from "@/lib/payments/account-access";
import { AdminCopyButton } from "./AdminCopyField";
import styles from "@/styles/requests/Requests.module.css";
import workspace from "@/styles/requests/RequestWorkspace.module.css";

/** Admin-only mount. The action separately authenticates and checks cleared funds. */
export function RequestPaymentAccount({ requestId, funded }: { requestId: string; funded: boolean }) {
  const [account, setAccount] = useState<PaymentAccountAccess | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  async function load() {
    if (busy || !funded) return;
    setBusy(true); setMessage("");
    try {
      const result = await getAdminPaymentAccount(requestId);
      if (result.error) setMessage(result.error);
      else if (result.data) setAccount(result.data);
      else setMessage("No payment account details were provided.");
    } catch { setMessage("Could not load payment account details. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className={workspace.credentials} aria-labelledby={`payment-login-${requestId}`}>
    <h3 id={`payment-login-${requestId}`}>Payment page login</h3>
    {!funded ? <p className={styles.muted}>Available after customer funds are confirmed.</p> : account ? <>
      <label className={workspace.credentialField}>Username<span className={workspace.credentialBox}><input type="text" dir="ltr" value={account.username} readOnly autoComplete="off" data-private-value onFocus={event => event.currentTarget.select()}/><AdminCopyButton value={account.username} label="username"/></span></label>
      <label className={workspace.credentialField}>Password<span className={workspace.credentialBox}><input type={visible ? "text" : "password"} dir="ltr" value={account.password} readOnly autoComplete="off" data-private-value onFocus={event => event.currentTarget.select()}/><button type="button" className={workspace.copyButton} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? <EyeOff size={15} aria-hidden="true"/> : <Eye size={15} aria-hidden="true"/>}</button><AdminCopyButton value={account.password} label="password"/></span></label>
      <button type="button" className={workspace.textButton} onClick={() => { setAccount(null); setVisible(false); setMessage(""); }}>Hide login details</button>
    </> : <button type="button" className={styles.secondary} disabled={busy} onClick={load}><KeyRound size={16} aria-hidden="true"/>{busy ? "Loading…" : "Show login details"}</button>}
    {message && <p role="status" className={styles.muted}>{message}</p>}
  </section>;
}
