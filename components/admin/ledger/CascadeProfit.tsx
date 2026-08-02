"use client";

import React from "react";
import cardStyles from "@/styles/admin/AdminCards.module.css";
import { TrendingUp, Coins, Briefcase } from "lucide-react";

interface CascadeProfitProps {
  exactTradingProfitIrt: number;
  exactFeeIncomeIrt: number;
}

export default function CascadeProfit({ exactTradingProfitIrt, exactFeeIncomeIrt }: CascadeProfitProps) {
  const fmt = (v: number) => Math.round(v).toLocaleString("en-AU");
  const grossProfit = exactTradingProfitIrt + exactFeeIncomeIrt;

  return (
    <div className={cardStyles.panel} style={{ marginBottom: "1.5rem", padding: "1.25rem 1.5rem" }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "1rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Cascade Profit Factors (Selected Period)
      </h3>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
        
        {/* Step 1: Realized Trading Profit */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "var(--bg-soft)", border: "1px solid var(--border-soft)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(5, 150, 105, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "#059669" }}>
            <TrendingUp size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-soft)", fontWeight: 600 }}>PERIOD TRADING PROFIT</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-main)", direction: "ltr", display: "inline-block" }}>
              {exactTradingProfitIrt >= 0 ? "+" : ""} {fmt(exactTradingProfitIrt)} <span style={{fontSize: "0.75rem", color: "var(--text-dim)"}}>IRT</span>
            </span>
          </div>
        </div>

        {/* Step 2: Fee Income */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "var(--bg-soft)", border: "1px solid var(--border-soft)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(5, 150, 105, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "#059669" }}>
            <Coins size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-soft)", fontWeight: 600 }}>PERIOD FEE INCOME</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--text-main)", direction: "ltr", display: "inline-block" }}>
              + {fmt(exactFeeIncomeIrt)} <span style={{fontSize: "0.75rem", color: "var(--text-dim)"}}>IRT</span>
            </span>
          </div>
        </div>

        {/* Step 3: Gross Profit */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem", background: "rgba(67, 56, 202, 0.04)", border: "1px solid rgba(67, 56, 202, 0.1)", borderRadius: "0.75rem" }}>
          <div style={{ background: "rgba(67, 56, 202, 0.1)", padding: "0.5rem", borderRadius: "0.5rem", color: "var(--accent)" }}>
            <Briefcase size={20} />
          </div>
          <div>
            <span style={{ display: "block", fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>PERIOD GROSS PROFIT</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--accent)", direction: "ltr", display: "inline-block" }}>
              = {fmt(grossProfit)} <span style={{fontSize: "0.75rem", color: "var(--accent)"}}>IRT</span>
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}