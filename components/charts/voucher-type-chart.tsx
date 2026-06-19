"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

type VoucherTypeData = {
  name: string;
  value: number;
  color?: string;
};

const COLORS = ['#3b82f6', '#ec4899', '#a855f7', '#0ea5e9', '#6b7280'];

export function VoucherTypeChart({ data, locale }: { data: VoucherTypeData[]; locale: string }) {
  const t = useTranslations("Charts");
  const isRTL = locale === "ar";

  const formattedData = data;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-900" dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex items-center gap-2 text-body-sm">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
            <span className="text-ink-600 dark:text-ink-300">{entry.name}:</span>
            <span className="font-mono font-medium text-ink-900 dark:text-white">
              {formatCurrency(entry.value, locale)}
            </span>
          </div>
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
        <PieChart>
          <Pie
            data={formattedData}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            iconType="circle"
            formatter={(value) => <span className={`text-ink-700 dark:text-ink-300 text-body-sm ${isRTL ? 'mr-1' : ''}`}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
