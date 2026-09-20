"use client";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { X, ArrowRight, ArrowLeft, Check, Landmark, UserRound } from "lucide-react";
import { createRecipient } from "@/app/actions/transaction.actions";
import type { Recipient, RecipientDirection, Profile } from "@/app/[locale]/dashboard/dashboard.types";
import styles from "@/styles/dashboard/RecipientModal.module.css";

const iranianBanks = ["Ayandeh Bank","BlueBank","Dey Bank","Eghtesad Novin Bank","Gardeshgari Bank","Ghavamin Bank","Hekmat Bank","Karafarin Bank","Keshavarzi Bank","Maskan Bank","Parsian Bank","Pasargad Bank","Post Bank of Iran","Refah Bank","Saman Bank","Sanat Va Maadan Bank","Sarmayeh Bank","Shahr Bank","Sina Bank","Tejarat Bank","Tosee Credit Institution","Tosee Saderat Bank","Tosee Taavon Bank","Bank Iran"];
const digits = (value:string) => value.replace(/[۰-۹٠-٩]/g,c=>String("۰۱۲۳۴۵۶۷۸۹".includes(c) ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c) : "٠١٢٣٤٥٦٧٨٩".indexOf(c)));
type Props = {direction:RecipientDirection;mode?:"standard"|"self_destination";profile?:Profile|null;locale?:"fa"|"en";onClose:()=>void;onCreated:(recipient:Recipient)=>void};

export function RecipientModal({direction,mode="standard",profile,locale="en",onClose,onCreated}:Props) {
  const fa = locale === "fa", aud = direction === "aud", own = mode === "self_destination";
  const text = (en:string,persian:string) => fa ? persian : en;
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), savingRef = useRef(false);
  const [step,setStep] = useState(0), [saving,setSaving] = useState(false), [error,setError] = useState("");
  const [values,setValues] = useState<Record<string,string>>({});
  const profileContact = {
    address:[profile?.address || profile?.address_line1,profile?.address_line2].filter(Boolean).join(", "),
    city:String(profile?.suburb || profile?.city || ""), state:String(profile?.state || ""),
    postcode:String(profile?.postcode || profile?.post_code || ""), country:String(profile?.country || ""),
    phone:String(profile?.mobile_number || profile?.phone_number || profile?.telephone || ""), email:String(profile?.email || ""),
  };
  const contactValue = (key:keyof typeof profileContact) => own ? profileContact[key] : values[key] || "";
  useEffect(()=>{
    const element = dialog.current, previousFocus = document.activeElement, overflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return ()=>{element?.close();document.body.style.overflow = overflow;if(previousFocus instanceof HTMLElement) previousFocus.focus();};
  },[]);
  function move(next:number) {setStep(next);setError("");requestAnimationFrame(()=>heading.current?.focus());}
  function close() {if(!savingRef.current) onClose();}
  const set = (key:string,value:string) => setValues(previous=>({...previous,[key]:value}));
  function field(key:string,en:string,persian:string,options:InputHTMLAttributes<HTMLInputElement> = {}, contact=false) {
    return <label className={styles.field} key={key} htmlFor={`recipient-${key}`}><span>{text(en,persian)}{options.required && <small aria-hidden="true"> *</small>}</span><input id={`recipient-${key}`} name={key} value={contact ? contactValue(key as keyof typeof profileContact) : values[key] || ""} onChange={event=>set(key,options.inputMode === "numeric" || options.type === "tel" ? digits(event.target.value) : event.target.value)} maxLength={250} dir="ltr" readOnly={contact && own} {...options}/></label>;
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(savingRef.current) return;
    if(step === 0) {move(1);return;}
    setError("");
    if(own && Object.values(profileContact).some(value=>!value.trim())) {
      setError(text("Complete your address and contact details in your verified profile first.","ابتدا آدرس و اطلاعات تماس را در پروفایل احراز هویت خود کامل کنید."));return;
    }
    const bank = (values.bank_name || "").trim(), name = (values.name || "").trim();
    const common = {direction,label:own ? `${text("My account","حساب شخصی من")} — ${bank}` : `${name} — ${bank}`,bank_name:bank};
    const payload:Omit<Recipient,"id"|"user_id"|"created_at"> = aud ? {
      ...common,account_name:name,bsb:(values.bsb || "").replace(/\D/g,""),account_number:values.account_number?.trim(),
      residential_address:contactValue("address").trim(),residential_city:contactValue("city").trim(),residential_state:contactValue("state").trim(),
      residential_postcode:contactValue("postcode").trim(),residential_country:contactValue("country").trim(),
      recipient_email:contactValue("email").trim(),recipient_phone:contactValue("phone").trim(),
    } : {
      ...common,full_name:name,bank_type:"other",bank_city:values.bank_city?.trim() || null,
      shaba_number:`IR${(values.shaba || "").replace(/\D/g,"")}`,card_number:values.card_number?.trim() || null,
      irt_address:contactValue("address").trim(),irt_city:contactValue("city").trim(),irt_state:contactValue("state").trim(),
      irt_postcode:contactValue("postcode").trim(),irt_country:contactValue("country").trim(),irt_phone:contactValue("phone").trim(),
    };
    savingRef.current = true;setSaving(true);
    try {
      const result = await createRecipient(payload);
      if("data" in result && result.data) {onCreated(result.data);onClose();}
      else setError(text("We couldn’t save this recipient. Check the details and try again.","ذخیره گیرنده ممکن نشد. اطلاعات را بررسی و دوباره تلاش کنید."));
    } catch {setError(text("Connection interrupted. Please try again.","ارتباط قطع شد. دوباره تلاش کنید."));}
    finally {savingRef.current = false;setSaving(false);}
  }
  return <dialog ref={dialog} className={styles.dialog} dir={fa ? "rtl":"ltr"} aria-labelledby="recipient-title" onCancel={event=>{event.preventDefault();close();}} onClick={event=>{if(event.target===event.currentTarget)close();}}>
    <div className={styles.surface}>
      <header className={styles.header}><span className={styles.country}>{aud ? "AU":"IR"}</span><div><p>{own ? text("YOUR OWN ACCOUNT","حساب شخصی شما"):text("NEW RECIPIENT","گیرنده جدید")}</p><h2 id="recipient-title">{aud ? text("An account in Australia","یک حساب در استرالیا"):text("An account in Iran","یک حساب در ایران")}</h2></div><button type="button" className={styles.close} onClick={close} disabled={saving} aria-label={text("Close","بستن")}><X size={20}/></button></header>
      <form onSubmit={event=>void submit(event)} className={styles.form}>
        <div className={styles.body}>
          <ol className={styles.steps} aria-label={text("Recipient setup","ثبت گیرنده")}><li aria-current={step===0 ? "step":undefined}><span>{step>0 ? <Check size={15}/>:<Landmark size={15}/>}</span>{text("Bank account","حساب بانکی")}</li><li aria-current={step===1 ? "step":undefined}><span><UserRound size={15}/></span>{text("Contact details","اطلاعات تماس")}</li></ol>
          <div className={styles.panel} key={step}><h3 ref={heading} tabIndex={-1}>{step===0 ? text("Start with the account.","ابتدا، مشخصات حساب.") : text("A few details about the recipient.","چند نکته درباره گیرنده.")}</h3><p className={styles.hint}>{text("Please enter details in English.","لطفاً اطلاعات را به انگلیسی وارد کنید.")}</p>
            <fieldset disabled={saving}>
            {step === 0 ? <>
              {field("name",aud ? "Account holder name":"Full name","نام صاحب حساب",{required:true,autoComplete:"off"})}
              <div className={styles.grid}>
                {aud ? field("bank_name","Bank name","نام بانک",{required:true,placeholder:"e.g. Commonwealth Bank"}) : <label className={styles.field} htmlFor="recipient-bank_name"><span>{text("Bank name","نام بانک")} *</span><select id="recipient-bank_name" name="bank_name" required value={values.bank_name||""} onChange={event=>set("bank_name",event.target.value)}><option value="">{text("Choose a bank","انتخاب بانک")}</option>{iranianBanks.map(bank=><option key={bank} value={bank}>{bank==="Bank Iran" ? text("Other","سایر"):bank}</option>)}</select></label>}
                {aud ? field("bsb","BSB","BSB",{required:true,inputMode:"numeric",pattern:"[0-9]{3}-?[0-9]{3}",placeholder:"123-456",maxLength:7}) : field("bank_city","Bank branch city (optional)","شهر شعبه بانک (اختیاری)",{maxLength:120,placeholder:"e.g. Tehran"})}
              </div>
              {aud ? field("account_number","Account number","شماره حساب",{required:true,inputMode:"numeric",pattern:"[0-9]{5,12}",maxLength:12}) : <>
                {field("shaba","Shaba / IBAN · 24 digits after IR","شماره شبا · ۲۴ رقم بعد از IR",{required:true,inputMode:"numeric",pattern:"[0-9]{24}",maxLength:24,placeholder:"24 digits, without IR"})}
                {field("card_number","Card number (optional)","شماره کارت (اختیاری)",{inputMode:"numeric",pattern:"[0-9]{16}",maxLength:16})}
                <details className={styles.notice}><summary>{text("Bank availability","دسترسی بانک‌ها")}</summary><p>{text("Sanctions notice: Bank Saderat Iran, Bank Mellat, Bank Sepah, Bank Melli Iran, Central Bank of Iran, Ansar Bank and Mehr Bank are listed in our existing restrictions. If your only account is with one of these banks, choose Other for review.","اطلاعیه محدودیت‌ها: بانک‌های صادرات، ملت، سپه، ملی، بانک مرکزی، انصار و مهر در فهرست محدودیت‌های فعلی ما هستند. اگر تنها حساب شما در یکی از این بانک‌هاست، گزینه سایر را برای بررسی انتخاب کنید.")}</p></details>
              </>}
            </> : <>
              <div className={styles.accountSummary}><Landmark size={18}/><div><strong>{values.name}</strong><span>{values.bank_name}{!aud && values.bank_city ? ` · ${values.bank_city}`:""}</span></div><button type="button" onClick={()=>move(0)}>{text("Edit","ویرایش")}</button></div>
              {own && <p className={styles.notice}>{text("Contact details are taken from your verified profile.","اطلاعات تماس از پروفایل احراز هویت شما وارد می‌شود.")}</p>}
              {field("address","Residential address","آدرس محل سکونت",{required:true,autoComplete:"off",maxLength:500},true)}
              <div className={styles.grid}>{field("city","Residential city","شهر محل سکونت",{required:true},true)}{field("state",aud ? "State":"Province",aud ? "ایالت":"استان",{required:true},true)}{field("postcode","Postcode","کد پستی",{required:aud},true)}{field("country","Country","کشور",{required:true},true)}</div>
              <div className={styles.grid}>{field("phone","Phone number","شماره تماس",{required:true,type:"tel"},true)}{aud && field("email","Email","ایمیل",{required:true,type:"email"},true)}</div>
            </>}
            </fieldset>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>
        <footer className={styles.footer}><button type="button" className={styles.back} disabled={saving} onClick={()=>step===0 ? close():move(0)}>{step>0 && <ArrowLeft size={16}/>} {step===0 ? text("Cancel","انصراف"):text("Back","بازگشت")}</button><button type="submit" className={styles.save} disabled={saving}>{saving ? <><span className={styles.spinner}/>{text("Saving…","در حال ذخیره…")}</>:step===0 ? <>{text("Continue","ادامه")}<ArrowRight size={17}/></>:<>{text("Save recipient","ذخیره گیرنده")}<Check size={17}/></>}</button></footer>
      </form>
    </div>
  </dialog>;
}
