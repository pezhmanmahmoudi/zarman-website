"use client";

import React from "react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { ArrowDownRight, ArrowUpRight, Scale, Wallet } from "lucide-react";

interface AccountMovementProps {
  openingBalance: number;
  moneyIn: number;
  moneyOut: number;
  closingBalance: number;
}

export default function AccountMovement({ openingBalance, moneyIn, moneyOut, closingBalance }: AccountMovementProps) {
  const fmt = (v: number) => Math.round(v).toLocaleString("en-AU");

  return (
    <div className={cardStyles.panel} style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        AUD Inventory Movement (Selected Period)
      </h3>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "var(--bg-soft)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(100,116,139,0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "var(--text-dim)" }}>
            <Wallet size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-soft)", fontWeight: 600 }}>OPENING BALANCE</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-main)" }}>{fmt(openingBalance)} AUD</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "rgba(5, 150, 105, 0.04)", border: "1px solid rgba(5, 150, 105, 0.1)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(5, 150, 105, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "#059669" }}>
            <ArrowDownRight size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>AUD PURCHASED</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#059669" }}>+ {fmt(moneyIn)} AUD</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.1)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(239, 68, 68, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "#ef4444" }}>
            <ArrowUpRight size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "#ef4444", fontWeight: 600 }}>AUD SOLD</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "#ef4444" }}>- {fmt(moneyOut)} AUD</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "rgba(67, 56, 202, 0.04)", border: "1px solid rgba(67, 56, 202, 0.1)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(67, 56, 202, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "var(--accent)" }}>
            <Scale size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>CLOSING BALANCE</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--accent)" }}>{fmt(closingBalance)} AUD</span>
          </div>
        </div>
      </div>
    </div>
  );
}