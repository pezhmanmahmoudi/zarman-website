import React from "react";
import { Info } from "lucide-react";
import styles from "./Tooltip.module.css";

export default function Tooltip({ text, children, iconSize = 14 }: { text: string, children: React.ReactNode, iconSize?: number }) {
  return (
    <span className={styles.wrapper}>
      {children}
      <Info size={iconSize} className={styles.icon} strokeWidth={2.5} />
      <span className={styles.tooltip}>{text}</span>
    </span>
  );
}