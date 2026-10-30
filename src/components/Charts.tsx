"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Slice } from "@/lib/queries";

import { money as fmtMoney, type Currency } from "@/lib/currency";

export function CategoryPie({ data, cur }: { data: Slice[]; cur: Currency }) {
  if (data.length === 0) return <p className="muted">No spending this month yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtMoney(Number(v), cur)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DailyBars({ data, cur }: { data: { day: string; in: number; out: number }[]; cur: Currency }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="day" fontSize={11} />
        <YAxis fontSize={11} width={50} />
        <Tooltip formatter={(v) => fmtMoney(Number(v), cur)} labelFormatter={(l) => `Day ${l}`} />
        <Bar dataKey="out" name="Spent" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendBars({ data, cur }: { data: { month: string; in: number; out: number }[]; cur: Currency }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" fontSize={11} />
        <YAxis fontSize={11} width={50} />
        <Tooltip formatter={(v) => fmtMoney(Number(v), cur)} />
        <Bar dataKey="out" name="Spent" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
