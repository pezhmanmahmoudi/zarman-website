"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useAnchoredPopover } from "../useAnchoredPopover";
import styles from "./Tooltip.module.css";

export default function Tooltip({ text, children, iconSize = 14 }: { text: string, children: React.ReactNode, iconSize?: number }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLSpanElement>(null);
  const id = useId();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(true);
  };
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);
  useAnchoredPopover({
    open, anchorRef, popoverRef, preferredSide: "top", align: "center",
    onClose: () => setOpen(false),
  });

  return (
    <span
      ref={anchorRef}
      className={styles.wrapper}
      onMouseEnter={show}
      onMouseLeave={() => { closeTimerRef.current = setTimeout(() => setOpen(false), 120); }}
      onFocus={show}
      onBlur={() => setOpen(false)}
    >
      {children}
      <button type="button" className={styles.trigger} aria-label="More information" aria-describedby={open ? id : undefined} onClick={show}>
        <Info size={iconSize} className={styles.icon} strokeWidth={2.5} aria-hidden="true" />
      </button>
      {open && <span ref={popoverRef} id={id} role="tooltip" popover="manual" className={styles.tooltip}>{text}</span>}
    </span>
  );
}
