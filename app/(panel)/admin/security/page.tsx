"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Copy, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import styles from "@/styles/admin/AdminSecurity.module.css";
import { OtpInput } from "@/components/admin/security/OtpInput";
import { supabase } from "@/lib/supabase";

type Enrollment = { factorId: string; qr: string; secret: string };
type State = "loading" | "none" | "needs-code" | "enabled";

const groupSecret = (secret: string) => secret.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim();

/**
 * Two-factor (TOTP) setup. Lives outside the protected admin layout on purpose: when two-factor
 * is enforced, an admin who has not enrolled yet must still be able to reach this page with a
 * password-only session to enrol. It only ever acts on the signed-in admin's own account.
 */
export default function AdminSecurityPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [factorId, setFactorId] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingOff, setConfirmingOff] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || userData.user.app_metadata?.role !== "admin") { router.replace("/admin/login"); return; }
    const [{ data: factors }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    const totp = factors?.totp?.[0];
    if (!totp) { setState("none"); return; }
    setFactorId(totp.id);
    setState(aal?.currentLevel === "aal2" ? "enabled" : "needs-code");
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function startEnrollment() {
    setBusy(true); setError("");
    try {
      // A half-finished earlier attempt would block a new one with the same name.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const factor of existing?.all ?? []) if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" });
      if (enrollError || !data) throw enrollError ?? new Error("Could not start setup.");
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Could not start setup. Check that two-factor is enabled in Supabase (Authentication → MFA).");
    } finally { setBusy(false); }
  }

  async function verify(id: string, value: string, afterSuccess: () => void) {
    if (busy || value.length !== 6) return;
    setBusy(true); setError("");
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: id });
      if (challengeError || !challenge) throw challengeError ?? new Error("Could not start verification.");
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: id, challengeId: challenge.id, code: value });
      if (verifyError) throw verifyError;
      afterSuccess();
    } catch {
      setError("That code did not work. Codes change every 30 seconds, so wait for the next one and try again.");
      setCode("");
    } finally { setBusy(false); }
  }

  async function copySecret() {
    if (!enrollment) return;
    try { await navigator.clipboard.writeText(enrollment.secret); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setError("Could not copy automatically. Select the key and copy it manually."); }
  }

  async function turnOff() {
    setBusy(true); setError("");
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (removeError) { setError(removeError.message); return; }
    setConfirmingOff(false);
    await load();
  }

  const finishEnrollment = () => { setDone(true); setTimeout(() => router.push("/admin/dashboard"), 1200); };

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <Link href="/admin/dashboard" className={styles.back}><ArrowLeft size={14} /> Back to the admin panel</Link>

        <section className={styles.card} aria-labelledby="mfa-title">
          <header className={styles.header}>
            <span className={`${styles.badgeIcon} ${state === "enabled" ? styles.badgeIconOn : ""}`}><ShieldCheck size={22} aria-hidden="true" /></span>
            <div>
              <h1 className={styles.title} id="mfa-title">Two-factor authentication</h1>
              <p className={styles.lead}>Sign in with something you know (your password) <em>and</em> something you have (your phone). A stolen password alone can no longer open the admin panel.</p>
            </div>
          </header>

          {state === "loading" && <div className={styles.skeleton} role="status" aria-label="Loading" />}

          {error && <p className={`${styles.message} ${styles.messageError}`} role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</p>}

          {state === "none" && !enrollment && (
            <>
              <span className={`${styles.status} ${styles.statusOff}`} style={{ width: "fit-content" }}>Not set up</span>
              <ul className={styles.benefits}>
                <li><CheckCircle2 size={16} aria-hidden="true" />Takes about two minutes and works with any authenticator app.</li>
                <li><CheckCircle2 size={16} aria-hidden="true" />Protects bank details, rates, promo codes and customer data.</li>
                <li><CheckCircle2 size={16} aria-hidden="true" />You enter a 6-digit code each time you sign in.</li>
              </ul>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} onClick={startEnrollment} disabled={busy}>
                <Smartphone aria-hidden="true" />{busy ? "Preparing…" : "Set up two-factor"}
              </button>
            </>
          )}

          {enrollment && !done && (
            <form onSubmit={event => { event.preventDefault(); void verify(enrollment.factorId, code, finishEnrollment); }}>
              <ol className={styles.steps}>
                <li className={styles.step}>
                  <div className={styles.stepBody}>
                    <h2 className={styles.stepTitle}>Install an authenticator app</h2>
                    <p className={styles.stepText}>Google Authenticator, Microsoft Authenticator, 1Password or Authy all work.</p>
                  </div>
                </li>
                <li className={styles.step}>
                  <div className={styles.stepBody}>
                    <h2 className={styles.stepTitle}>Scan this code</h2>
                    <div className={styles.qrBox}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URI from Supabase */}
                      <img className={styles.qr} src={enrollment.qr} alt="Two-factor QR code" />
                      <p className={styles.stepText} style={{ textAlign: "center" }}>Can&apos;t scan? Enter this key in the app instead:</p>
                      <div className={styles.secretRow}>
                        <code className={styles.secret}>{groupSecret(enrollment.secret)}</code>
                        <button type="button" className={styles.btn} onClick={copySecret} aria-label="Copy the setup key">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
                      </div>
                    </div>
                  </div>
                </li>
                <li className={styles.step}>
                  <div className={styles.stepBody}>
                    <h2 className={styles.stepTitle}>Enter the 6-digit code</h2>
                    <p className={styles.stepText}>The app shows a new code every 30 seconds.</p>
                    <OtpInput value={code} onChange={value => { setCode(value); setError(""); }} onComplete={value => void verify(enrollment.factorId, value, finishEnrollment)} disabled={busy} autoFocus invalid={Boolean(error)} />
                  </div>
                </li>
              </ol>
              <div style={{ display: "grid", gap: ".5rem", marginTop: "1.25rem" }}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Turn on two-factor"}</button>
                <button type="button" className={`${styles.btn} ${styles.btnWide}`} onClick={() => { setEnrollment(null); setCode(""); setError(""); }} disabled={busy}>Cancel</button>
              </div>
            </form>
          )}

          {done && <p className={`${styles.message} ${styles.messageOk}`} role="status"><CheckCircle2 size={16} aria-hidden="true" />Two-factor is on. Taking you to the admin panel…</p>}

          {state === "needs-code" && (
            <form onSubmit={event => { event.preventDefault(); void verify(factorId, code, () => { setCode(""); void load(); }); }} style={{ display: "grid", gap: "1rem" }}>
              <span className={`${styles.status} ${styles.statusOn}`} style={{ width: "fit-content" }}><KeyRound size={14} aria-hidden="true" />Set up on this account</span>
              <p className={styles.stepText}>Enter the current code from your authenticator app to manage two-factor.</p>
              <OtpInput value={code} onChange={value => { setCode(value); setError(""); }} onComplete={value => void verify(factorId, value, () => { setCode(""); void load(); })} disabled={busy} autoFocus invalid={Boolean(error)} />
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Continue"}</button>
            </form>
          )}

          {state === "enabled" && (
            <>
              <span className={`${styles.status} ${styles.statusOn}`} style={{ width: "fit-content" }}><CheckCircle2 size={14} aria-hidden="true" />Two-factor is on</span>
              <ul className={styles.benefits}>
                <li><CheckCircle2 size={16} aria-hidden="true" />Your account needs a code from your phone every time you sign in.</li>
                <li><CheckCircle2 size={16} aria-hidden="true" />Keep your phone safe and back up your authenticator app if it offers it.</li>
              </ul>
              {!confirmingOff
                ? <button type="button" className={`${styles.btn} ${styles.btnGhostDanger}`} style={{ width: "fit-content" }} onClick={() => setConfirmingOff(true)}>Turn off two-factor</button>
                : <div className={styles.confirm} role="alertdialog" aria-label="Confirm turning off two-factor">
                    <p><strong>Turn off two-factor?</strong> Your account will be protected by your password only.</p>
                    <div className={styles.confirmActions}>
                      <button type="button" className={`${styles.btn} ${styles.btnGhostDanger}`} style={{ borderColor: "#efc2cb" }} onClick={turnOff} disabled={busy}>{busy ? "Turning off…" : "Yes, turn it off"}</button>
                      <button type="button" className={styles.btn} onClick={() => setConfirmingOff(false)} disabled={busy}>Keep it on</button>
                    </div>
                  </div>}
            </>
          )}
        </section>

        <p className={styles.help}><strong>Lost your phone?</strong> Ask the other administrator or the account owner to reset your second factor in Supabase. You can then set it up again on a new phone.</p>
      </div>
    </div>
  );
}
