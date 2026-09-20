import type { CSSProperties } from "react";
import { ArrowUpRight, Check, FileCheck2, Landmark, ShieldCheck, Sparkles } from "lucide-react";
import styles from "@/styles/dashboard/TransferJourney.module.css";

export function TransferJourneyVisual({ stage = 0, from = "AUD", to = "IRT", quiet = false }: {
  stage?: number; from?: string; to?: string; quiet?: boolean;
}) {
  const Icon = [FileCheck2, Landmark, FileCheck2, ShieldCheck, Check][stage] || Sparkles;
  return <div className={styles.visual} data-stage={stage} data-quiet={quiet} aria-hidden="true">
    <div className={styles.orbitalPlane}><i /><i /><i /></div>
    <div className={styles.currencyOrigin}><span>{from}</span><small>{from === "AUD" ? "AUSTRALIA" : "IRAN"}</small></div>
    <div className={styles.currencyDestination}><span>{to}</span><small>{to === "AUD" ? "AUSTRALIA" : "IRAN"}</small></div>
    <div className={styles.core} key={stage}><div className={styles.coreGlass}><Icon size={43} strokeWidth={1.45}/></div><span className={styles.coreHalo}/></div>
    <span className={styles.routeSpark}/><span className={styles.routeSparkTwo}/>
    {stage === 4 && !quiet && <div className={styles.celebration}>{Array.from({length:8}, (_,i)=><i key={i} style={{"--spark":i} as CSSProperties}/>)}</div>}
    <span className={styles.visualMark}><ArrowUpRight size={12}/> ZARMAN</span>
  </div>;
}
