"use client";

import React, { useState, useEffect, useRef } from "react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { X, FileText, User, ShieldAlert } from "lucide-react";

interface LedgerDrillDownProps {
  children: React.ReactNode;
  ledgerDataMap: Record<string, any>; 
}

export default function LedgerDrillDown({ children, ledgerDataMap }: LedgerDrillDownProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const activeRecord = selectedId ? ledgerDataMap[selectedId] : null;

  return (
    // STRICT FLEX BOUNDARY: minHeight: 0 is the golden key for nested flex scroll containers
    <div ref={containerRef} style={{ position: "relative", width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {children}

      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(17, 24, 39, 0.4)", backdropFilter: "blur(2px)", zIndex: 999 }} 
        />
      )}

      <div 
        style={{
          position: "fixed", top: 0, right: 0, height: "100dvh", width: "100%", maxWidth: "480px",
          background: "var(--bg-app)", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)", zIndex: 1000,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex", flexDirection: "column", direction: "ltr"
        }}
      >
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
                <div className={cardStyles.kycDetailRow} style={{ gridColumn: "1 / -1" }}><p className={cardStyles.kycDetailRowLabel}>Sender / Customer</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.sender || "N/A"}</p></div>
                <div className={cardStyles.kycDetailRow} style={{ gridColumn: "1 / -1" }}><p className={cardStyles.kycDetailRowLabel}>Recipient</p><p className={cardStyles.kycDetailRowValue}>{activeRecord.recipient || "N/A"}</p></div>
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
    </div>
  );
}