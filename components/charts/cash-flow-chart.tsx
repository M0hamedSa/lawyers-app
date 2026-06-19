"use client";

import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

type CashFlowData = {
  month: string;
  payments: number;
  expenses: number;
};

export function CashFlowChart({ data, locale }: { data: CashFlowData[]; locale: string }) {
  const t = useTranslations("Charts");
  const isRTL = locale === "ar";

  // Format month to short name (e.g. "Jan", "Feb") based on locale
  const formatMonth = (monthString: string) => {
    const [year, month] = monthString.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString(locale, { month: "short" });
  };

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-900" dir={isRTL ? "rtl" : "ltr"}>
          <p className="mb-2 text-title-sm text-ink-800 dark:text-ink-100">{label ? formatMonth(label) : ""}</p>
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-body-sm">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-ink-600 dark:text-ink-300">{entry.name}:</span>
              <span className="font-mono font-medium text-ink-900 dark:text-white">
                {formatCurrency(entry.value, locale)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!data || data.length === 0) {
    return <div className="flex h-[300px] items-center justify-center text-ink-500">{t("noData")}</div>;
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1f8a65" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#1f8a65" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#cf2d56" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#cf2d56" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ink-200)" opacity={0.5} />
          <XAxis 
            dataKey="month" 
            tickFormatter={formatMonth} 
            reversed={isRTL}
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--ink-500)', fontSize: 12 }} 
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--ink-500)', fontSize: 12, textAnchor: isRTL ? 'start' : 'end', dx: isRTL ? -10 : 10 }}
            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            orientation={isRTL ? 'right' : 'left'}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="payments"
            name={t("payments")}
            stroke="#1f8a65"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorPayments)"
          />
          <Area
            type="monotone"
            dataKey="expenses"
            name={t("expenses")}
            stroke="#cf2d56"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorExpenses)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
