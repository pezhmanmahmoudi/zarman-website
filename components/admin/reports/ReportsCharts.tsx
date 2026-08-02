"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportDashboard } from "@/lib/reporting/types";
import styles from "@/styles/admin/Reports.module.css";

const COLORS = ["#146c5a", "#d97706", "#2563eb", "#dc2626", "#7c3aed", "#64748b"];
const compact = (value: number) => new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export default function ReportsCharts({ dashboard }: { dashboard: ReportDashboard }) {
  const expenses = Object.entries(dashboard.profitAndLoss.expenseBreakdown).map(([name, value]) => ({ name, value }));
  return (
    <div className={styles.chartGrid}>
      <section className={`${styles.panel} ${styles.chartWide}`}>
        <div className={styles.panelHeader}><div><h2>Profitability Trend</h2><p>Trading, fee and net profit by reporting day</p></div></div>
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
            <AreaChart data={dashboard.series} margin={{ left: 8, right: 12 }}>
              <defs><linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#146c5a" stopOpacity={0.24}/><stop offset="95%" stopColor="#146c5a" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="#e8ecef" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(value) => compact(Number(value))} />
              <Legend />
              <Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#146c5a" fill="url(#profitFill)" strokeWidth={2} />
              <Line type="monotone" dataKey="tradingProfit" name="Trading profit" stroke="#2563eb" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="feeIncome" name="Fee income" stroke="#d97706" dot={false} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Expense Mix</h2><p>Paid operating expenses</p></div></div>
        <div className={styles.chartCanvas}>
          {expenses.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}><PieChart><Pie data={expenses} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="76%" paddingAngle={2}>{expenses.map((item, index) => <Cell key={item.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => compact(Number(value))} /><Legend /></PieChart></ResponsiveContainer>
          ) : <div className={styles.chartEmpty}>No expenses in this period</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Buy / Sell Volume</h2><p>AUD inventory movement</p></div></div>
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}><BarChart data={dashboard.series}><CartesianGrid stroke="#e8ecef" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={30}/><YAxis tickFormatter={compact} tick={{ fontSize: 11 }} tickLine={false} axisLine={false}/><Tooltip formatter={(value) => compact(Number(value))}/><Legend/><Bar dataKey="audBought" name="AUD bought" fill="#2563eb" radius={[3,3,0,0]}/><Bar dataKey="audSold" name="AUD sold" fill="#d97706" radius={[3,3,0,0]}/></BarChart></ResponsiveContainer>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.chartWide}`}>
        <div className={styles.panelHeader}><div><h2>Exchange Rate & WAC</h2><p>Average traded rate against inventory cost</p></div></div>
        <div className={styles.chartCanvas}>
          <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}><LineChart data={dashboard.series}><CartesianGrid stroke="#e8ecef" vertical={false}/><XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28}/><YAxis tickFormatter={compact} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52}/><Tooltip formatter={(value) => compact(Number(value))}/><Legend/><Line type="monotone" dataKey="averageRate" name="Average rate" stroke="#2563eb" dot={false} strokeWidth={2}/><Line type="monotone" dataKey="wac" name="WAC" stroke="#dc2626" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}