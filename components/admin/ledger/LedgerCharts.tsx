"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import cardStyles from "@/styles/admin/AdminCards.module.css";

interface LedgerChartsProps {
  dailyData: { date: string; volume: number }[];
  typeDistribution: { name: string; value: number }[];
}

const COLORS = ["#059669", "#ef4444", "#3b82f6"]; // Buy, Sell, Transfer

export default function LedgerCharts({ dailyData, typeDistribution }: LedgerChartsProps) {
  
  if (dailyData.length === 0) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: "1.5rem", marginBottom: "1.5rem", minWidth: 0 }}>
      
      {/* Area Chart: Daily Volume */}
      <div className={cardStyles.panel} style={{ padding: "1.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "1rem", fontFamily: "var(--font-fa-content)" }}>حجم تراکنش روزانه (AUD)</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-dim)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-dim)" }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} width={45} />
              <Tooltip 
                formatter={(value) => {
                  const num = Number(value);
                  return isNaN(num) ? String(value) : `$${num.toLocaleString()}`;
                }}
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)", borderRadius: "0.5rem" }}
                itemStyle={{ color: "var(--text-main)", fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="volume" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pie Chart: Distribution */}
      <div className={cardStyles.panel} style={{ padding: "1.5rem" }}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "1rem", fontFamily: "var(--font-fa-content)" }}>توزیع تراکنش‌ها (AUD)</h3>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={typeDistribution}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {typeDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => {
                  const num = Number(value);
                  return isNaN(num) ? String(value) : `$${num.toLocaleString()}`;
                }}
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border-soft)", borderRadius: "0.5rem", fontWeight: 600 }}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontFamily: "var(--font-fa-content)", fontSize: "0.8rem", color: "var(--text-main)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
