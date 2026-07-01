import React from "react";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { FA } from "@/lib/treasury-utils";
import Tooltip from "@/components/ui/Tooltip/Tooltip";
import s from "@/styles/admin/Treasury.module.css";

export default function AlertsSection({ alerts = [], accountingWarnings = [] }: { alerts: any[], accountingWarnings: string[] }) {
  return (
    <>
      {accountingWarnings.length > 0 && (
        <details className={`${s.warnBanner} ${s.warnBannerSpaced}`}>
          <summary className={s.warnBannerSummary}>
            <AlertCircle size={16} className={s.warnBannerIcon} />
            <span className={s.warnBannerTitle}>
              <Tooltip text="هشدارهایی که نشان‌دهنده ناهماهنگی یا خطای منطقی در سیستم حسابداری دوبل هستند">{FA.warnBannerTitle}</Tooltip>
            </span>
            <span className={s.warnBannerCount}>{accountingWarnings.length} {FA.warnUnit}</span>
            <span className={s.warnBannerToggle}>{FA.warnBannerHint}</span>
          </summary>
          <div className={s.warnBannerList}>
            {accountingWarnings.map((w: string, i: number) => {
              const isCritical = w.includes("منفی شد") || w.includes("negative");
              return (
                <div key={i} className={`${s.warnBannerItem} ${isCritical ? s.warnBannerItemCritical : ""}`}>
                  <span className={s.warnBannerBullet}>{isCritical ? "🔴" : "•"}</span>
                  <span>{w}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {alerts && alerts.length > 0 && (
        <div className={s.alertBanner}>
          {alerts.map((alert: any, idx: number) => (
            <div key={idx} className={`${s.alertItem} ${alert.severity === 'critical' ? s.alertItemCritical : alert.severity === 'warning' ? s.alertItemWarning : s.alertItemInfo}`}>
              {alert.severity === 'critical' ? <AlertTriangle size={20} /> : alert.severity === 'warning' ? <AlertCircle size={20} /> : <Info size={20} />}
              <div className={s.alertContent}>
                <strong className={s.alertTitle}>{alert.titleFA}</strong>
                <p className={s.alertMessage}>{alert.messageFA}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}