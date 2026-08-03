"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import overlayStyles from "@/styles/admin/AdminOverlays.module.css";
import { X, FileText, User, ShieldAlert } from "lucide-react";

interface LedgerDrillDownProps {
  children: React.ReactNode;
  ledgerDataMap: Record<string, any>; 
}

export default function LedgerDrillDown({ children, ledgerDataMap }: LedgerDrillDownProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleTableClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const row = target.closest("tr[data-id]") || target.closest("tr[id]"); 
      if (row) {
        const id = row.getAttribute("data-id") || row.getAttribute("id");
        if (id && ledgerDataMap[id]) {
          setSelectedId(id);
          setIsOpen(true);
        }
      }
    };

    const tableContainer = containerRef.current;
    if (tableContainer) tableContainer.addEventListener("click", handleTableClick);
    return () => {
      if (tableContainer) tableContainer.removeEventListener("click", handleTableClick);
    };
  }, [ledgerDataMap]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const activeRecord = selectedId ? ledgerDataMap[selectedId] : null;

  return (
    // STRICT FLEX BOUNDARY: minHeight: 0 is the golden key for nested flex scroll containers
    <div ref={containerRef} style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {children}

      {mounted && createPortal(
        <>
          {isOpen && (
            <div
              onClick={() => setIsOpen(false)}
              className={overlayStyles.overlay}
              aria-hidden="true"
            />
          )}

          <div className={`${overlayStyles.drillPanel} ${isOpen ? overlayStyles.drillPanelOpen : ""}`} role="dialog" aria-modal="true" aria-label="Ledger details">
            {activeRecord && (
              <>
                <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-card)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ background: "rgba(67, 56, 202, 0.1)", color: "var(--accent)", padding: "0.5rem", borderRadius: "0.5rem" }}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>Transaction Record</h2>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "monospace" }}>ID: {activeRecord.id}</span>
                    </div>
                  </div>
                  <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: "0.5rem" }}>
                    <X size={20} />
                  </button>
                </div>

                <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div className={cardStyles.kycDetailList} style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.75rem", border: `1px solid var(--border-soft)` }}>
                    <h3 className={cardStyles.sectionHeading} style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", alignItems: "center" }}><FileText size={14} /> Ledger Details</h3>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Type</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.type}</p></div>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Amount (AUD)</p><p className={cardStyles.kycDetailRowValue}>${activeRecord.amount_aud?.toLocaleString()}</p></div>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Exchange Rate</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.exchange_rate?.toLocaleString()} IRT</p></div>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Fee (AUD)</p><p className={cardStyles.kycDetailRowValue}>${activeRecord.fee_aud}</p></div>
                  </div>

                  <div className={cardStyles.kycDetailList} style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.75rem", border: `1px solid var(--border-soft)` }}>
                    <h3 className={cardStyles.sectionHeading} style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", alignItems: "center" }}><User size={14} /> Linked Entities</h3>
                    <div className={cardStyles.kycDetailRow} style={{ gridColumn: "1 / -1" }}><p className={cardStyles.kycDetailRowLabel}>Customer sender</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.sender || "N/A"}</p></div>
                    <div className={cardStyles.kycDetailRow} style={{ gridColumn: "1 / -1" }}><p className={cardStyles.kycDetailRowLabel}>Customer recipient</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.recipient || "N/A"}</p></div>
                  </div>

                  <div className={cardStyles.kycDetailList} style={{ background: "var(--bg-card)", padding: "1rem", borderRadius: "0.75rem", border: `1px solid var(--border-soft)` }}>
                    <h3 className={cardStyles.sectionHeading} style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", alignItems: "center" }}><ShieldAlert size={14} /> Audit Trail</h3>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Entry Type</p><p className={cardStyles.kycDetailRowValue} style={{ textTransform: "capitalize" }}>{activeRecord.entry_type}</p></div>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Gregorian Date</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.date_gregorian}</p></div>
                    <div className={cardStyles.kycDetailRow}><p className={cardStyles.kycDetailRowLabel}>Created At</p><p className={cardStyles.kycDetailRowValue}>{new Date(activeRecord.created_at).toLocaleString()}</p></div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}