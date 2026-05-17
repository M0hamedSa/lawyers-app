"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { LedgerTransaction } from "@/lib/supabase/types";

const COLORS = {
  payment: "#10b981", // Emerald 500
  expense: "#ef4444", // Red 500
  balance: "#8b7355", // Brass/Gold-ish
};

// --- Distribution Pie Chart ---
export function TransactionDistributionChart({ transactions }: { transactions: LedgerTransaction[] }) {
  const locale = useLocale();
  const t = useTranslations("Charts");
  const isRtl = locale === "ar";
  
  const data = transactions.reduce(
    (acc, t) => {
      if (t.type === "payment") acc[0].value += Number(t.amount);
      else acc[1].value += Number(t.amount);
      return acc;
    },
    [
      { name: t("payments"), value: 0, color: COLORS.payment },
      { name: t("expenses"), value: 0, color: COLORS.expense },
    ]
  ).filter(d => d.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <RechartsTooltip 
            formatter={(value: number) => formatCurrency(value, locale)}
            contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
              textAlign: isRtl ? 'right' : 'left',
              backgroundColor: 'var(--tooltip-bg, #fff)',
              color: 'var(--tooltip-text, #111)'
            }}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle" 
            formatter={(value) => (
              <span className={`text-sm ${isRtl ? 'mr-1.5' : 'ml-1.5'}`}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Income vs Expense Bar Chart ---
export function IncomeExpenseBarChart({ 
  transactions,
  showPayments = true,
}: { 
  transactions: LedgerTransaction[];
  showPayments?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("Charts");
  const isRtl = locale === "ar";
  
  // Group by month
  const grouped = transactions.reduce((acc, t) => {
    const month = t.date.slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = { month, payments: 0, expenses: 0 };
    if (t.type === "payment") acc[month].payments += Number(t.amount);
    else acc[month].expenses += Number(t.amount);
    return acc;
  }, {} as Record<string, { month: string; payments: number; expenses: number }>);

  const data = Object.values(grouped).sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className="h-72 w-full pt-4" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ 
          top: 10, 
          right: isRtl ? 80 : 10, 
          left: isRtl ? 10 : 0, 
          bottom: 0 
        }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="month" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
            tick={{ fill: '#6b7280' }}
            reversed={isRtl}
          />
          <YAxis 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
            width={80}
            tickFormatter={(value) => formatCurrency(value, locale, true)}
            tick={{ fill: '#6b7280' }}
            orientation={isRtl ? "right" : "left"}
          />
          <Tooltip 
            cursor={{ fill: '#f9fafb', opacity: 0.1 }}
            formatter={(value: number) => formatCurrency(value, locale)}
            contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
              textAlign: isRtl ? 'right' : 'left',
              backgroundColor: 'var(--tooltip-bg, #fff)',
              color: 'var(--tooltip-text, #111)'
            }}
          />
          <Legend 
            iconType="circle" 
            formatter={(value) => (
              <span className={`text-sm ${isRtl ? 'mr-1.5' : 'ml-1.5'}`}>{value}</span>
            )}
          />
          {showPayments && (
            <Bar dataKey="payments" fill={COLORS.payment} radius={[4, 4, 0, 0]} name={t("income")} />
          )}
          <Bar dataKey="expenses" fill={COLORS.expense} radius={[4, 4, 0, 0]} name={t("expense")} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// --- Cumulative Balance Area Chart ---
export function BalanceHistoryChart({ transactions }: { transactions: LedgerTransaction[] }) {
  const locale = useLocale();
  const isRtl = locale === "ar";
  
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const data = sorted.map(t => {
    balance += t.type === "payment" ? Number(t.amount) : -Number(t.amount);
    return { date: t.date, balance };
  });

  return (
    <div className="h-72 w-full pt-4" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ 
          top: 10, 
          right: isRtl ? 80 : 10, 
          left: isRtl ? 10 : 0, 
          bottom: 0 
        }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.balance} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.balance} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis 
            dataKey="date" 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            tick={{ fill: '#6b7280' }}
            minTickGap={30}
            reversed={isRtl}
          />
          <YAxis 
            fontSize={11} 
            tickLine={false} 
            axisLine={false}
            width={80}
            tickFormatter={(value) => formatCurrency(value, locale, true)}
            tick={{ fill: '#6b7280' }}
            orientation={isRtl ? "right" : "left"}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value, locale)}
            contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
              textAlign: isRtl ? 'right' : 'left',
              backgroundColor: 'var(--tooltip-bg, #fff)',
              color: 'var(--tooltip-text, #111)'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="balance" 
            stroke={COLORS.balance} 
            fillOpacity={1} 
            fill="url(#colorBalance)" 
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
