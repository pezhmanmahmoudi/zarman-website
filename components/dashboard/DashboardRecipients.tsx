"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Search, UserRound, UsersRound, Landmark } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { useDashboard } from "./DashboardShell";
import { getRecipients } from "@/app/actions/transaction.actions";
import { RecipientModal } from "./RecipientModal";
import type { Recipient, RecipientDirection } from "@/app/[locale]/dashboard/dashboard.types";
import { dashboardHref } from "@/lib/dashboard/navigation";
import styles from "@/styles/dashboard/DashboardRecipients.module.css";

export function DashboardRecipients() {
  const locale = useLocale(), fa = locale === "fa", {profile} = useDashboard();
  const [recipients,setRecipients] = useState<Recipient[]>([]), [direction,setDirection] = useState<RecipientDirection>("aud");
  const [query,setQuery] = useState(""), [loading,setLoading] = useState(true), [error,setError] = useState(false), [attempt,setAttempt] = useState(0);
  const [modal,setModal] = useState<"standard"|"self_destination"|null>(null);
  const text = (en:string,persian:string) => fa ? persian : en;
  useEffect(()=>{
    let active = true;
    getRecipients().then(result=>{if(!active)return;if("data" in result && result.data)setRecipients(result.data);else setError(true);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[attempt,profile?.id]);
  function retry() {setLoading(true);setError(false);setAttempt(value=>value+1);}
  const filtered = recipients.filter(recipient=>recipient.direction===direction && [recipient.label,recipient.bank_name,recipient.bank_city].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <div className={styles.page}>
    <header className={styles.heading}><div><p>{text("YOUR CONNECTIONS","ارتباط‌های شما")}</p><h1>{text("Your recipients, all together.","همه گیرندگان، یکجا.")}</h1><span>{text("Saved accounts, ready for your next transfer.","حساب‌های ذخیره‌شده، آماده انتقال بعدی شما.")}</span></div><button className={styles.primary} onClick={()=>setModal("standard")}><Plus size={18}/>{text("New recipient","گیرنده جدید")}</button></header>
    <section className={styles.directory}>
      <div className={styles.toolbar}><div className={styles.tabs} role="group" aria-label={text("Recipient country","کشور گیرنده")}><button aria-pressed={direction==="aud"} onClick={()=>setDirection("aud")}><span>AU</span>{text("Australia","استرالیا")}</button><button aria-pressed={direction==="irt"} onClick={()=>setDirection("irt")}><span>IR</span>{text("Iran","ایران")}</button></div><label className={styles.search}><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={text("Find a recipient","جستجوی گیرنده")} aria-label={text("Find a recipient","جستجوی گیرنده")}/></label></div>
      {loading ? <div className={styles.empty} role="status">{text("Loading your recipients…","در حال دریافت گیرندگان…")}</div> : error ? <div className={styles.empty} role="alert"><p>{text("We couldn’t load your recipients.","دریافت گیرندگان ممکن نشد.")}</p><button className={styles.primary} onClick={retry}>{text("Try again","تلاش دوباره")}</button></div> : filtered.length ? <div className={styles.grid}>{filtered.map((recipient,index)=>{
        const number = recipient.account_number || recipient.shaba_number || recipient.irt_account_number || "";
        return <article className={styles.recipient} key={recipient.id} style={{animationDelay:`${Math.min(index,5)*45}ms`}}><span className={styles.avatar}>{String(recipient.account_name || recipient.full_name || recipient.label).trim().slice(0,1).toUpperCase()}</span><span className={styles.currency}>{recipient.direction==="aud" ? "AUD":"IRT"}</span><h2>{recipient.account_name || recipient.full_name || recipient.label}</h2><p><Landmark size={14}/>{recipient.bank_name || text("Bank account","حساب بانکی")}</p>{recipient.bank_city && <span className={styles.bankCity}>{text("Bank branch","شعبه بانک")} · {recipient.bank_city}</span>}<div className={styles.cardFooter}><bdi>{number ? `•••• ${number.slice(-4)}`:"—"}</bdi><Link href={`${dashboardHref(locale,"transfer")}&requestDirection=${recipient.direction==="aud" ? "buy_aud":"sell_aud"}&recipient=${encodeURIComponent(recipient.id)}`}>{text("Send money","ارسال وجه")}<ArrowUpRight size={16}/></Link></div></article>;
      })}</div> : <div className={styles.empty}><span className={styles.emptyIcon}><UsersRound size={30}/></span><h2>{query ? text("No matching recipients","گیرنده‌ای پیدا نشد"):text("Your next connection starts here.","ارتباط بعدی شما از اینجا شروع می‌شود.")}</h2><p>{query ? text("Try a different name or bank.","نام یا بانک دیگری را جستجو کنید."):text("Add an account once. Choose it whenever you send.","حساب را یک بار اضافه و در هر انتقال انتخاب کنید.")}</p>{!query && <button className={styles.primary} onClick={()=>setModal("standard")}><Plus size={17}/>{text("Add your first recipient","افزودن اولین گیرنده")}</button>}</div>}
    </section>
    <section className={styles.ownAccount}><span><UserRound size={22}/></span><div><h2>{text("Sending to yourself?","به حساب خودتان می‌فرستید؟")}</h2><p>{text("Use your verified profile to add your own destination account.","با اطلاعات پروفایل احراز هویت، حساب مقصد خودتان را اضافه کنید.")}</p></div><button onClick={()=>setModal("self_destination")}>{text("Add my account","افزودن حساب شخصی")}<ArrowUpRight size={17}/></button></section>
    {modal && <RecipientModal direction={direction} mode={modal} profile={profile} locale={locale} onClose={()=>setModal(null)} onCreated={recipient=>{setRecipients(previous=>[recipient,...previous.filter(item=>item.id!==recipient.id)]);setError(false);}}/>}
  </div>;
}
