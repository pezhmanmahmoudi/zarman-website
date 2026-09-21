import Image from "next/image";
import { Check, FileCheck2, Landmark, ShieldCheck } from "lucide-react";
import styles from "@/styles/dashboard/TransferJourney.module.css";

export function TransferJourneyVisual({ stage = 0, from = "AUD", to = "IRT", quiet = false }: {
  stage?: number; from?: string; to?: string; quiet?: boolean;
}) {
  const safeStage = Math.max(0, Math.min(4, stage));
  const Icon = [FileCheck2, Landmark, FileCheck2, ShieldCheck, Check][safeStage];

  return <div className={styles.visual} data-stage={stage} data-quiet={quiet} aria-hidden="true">
    <div className={styles.connectionRail} aria-hidden="true"><span/><span/></div>
    <div className={styles.currencyOrigin}><span>{from}</span><small>{from === "AUD" ? "AUSTRALIA" : "IRAN"}</small></div>
    <div className={styles.currencyDestination}><span>{to}</span><small>{to === "AUD" ? "AUSTRALIA" : "IRAN"}</small></div>
    <div className={styles.connectionCore} key={safeStage}>
      <span className={styles.connectionAura}/>
      <span className={styles.connectionRing}/>
      <div className={styles.logoFrame}>
        <Image
          className={styles.logoImage}
          src="/images/logo-no-text-light.svg"
          alt=""
          width={116}
          height={116}
          draggable={false}
        />
        <svg className={styles.signatureRibbon} viewBox="0 0 160 160" focusable="false">
          <path className={styles.ribbonBase} pathLength="1" d="M38 43h87L39 117h84"/>
          <path className={styles.ribbonPulse} pathLength="1" d="M38 43h87L39 117h84"/>
        </svg>
        <span className={styles.stageBadge}><Icon size={17} strokeWidth={1.8}/></span>
      </div>
    </div>
    <span className={styles.visualMark}>ZARMAN CONNECTION <b>{safeStage + 1}/5</b></span>
  </div>;
}
