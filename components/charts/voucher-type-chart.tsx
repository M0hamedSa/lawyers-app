"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, Tooltip, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

type VoucherTypeData = {
  name: string;
  value: number;
  color?: string;
};

const COLORS = ['#3b82f6', '#ec4899', '#a855f7', '#0ea5e9', '#6b7280'];

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 300, height: 200 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return size;
}

export function VoucherTypeChart({ data, locale }: { data: VoucherTypeData[]; locale: string }) {
  const t = useTranslations("Charts");
  const isRTL = locale === "ar";
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrapperRef);

  const formattedData = data;

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { fill: string } }[] }) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-900" dir={isRTL ? "rtl" : "ltr"}>
          <div className="flex items-center gap-2 text-body-sm">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.payload.fill }} />
            <span className="text-ink-600 dark:text-ink-300">{entry.name}:</span>
            <span className="font-mono font-medium text-ink-900 dark:text-white">{formatCurrency(entry.value, locale)}</span>
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
    <div ref={wrapperRef} className="h-[300px] w-full">
      <PieChart width={width} height={height}>
        <Pie data={formattedData} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value) => <span className={`text-ink-700 dark:text-ink-300 text-body-sm ${isRTL ? 'mr-1' : ''}`}>{value}</span>} />
      </PieChart>
    </div>
  );
}
