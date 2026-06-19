"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatCurrency } from "@/lib/utils";

type ClientData = {
  name: string;
  payments: number;
  expenses: number;
};

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

export function ClientBreakdownChart({ data, locale }: { data: ClientData[]; locale: string }) {
  const t = useTranslations("Charts");
  const isRTL = locale === "ar";
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(wrapperRef);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-ink-100 bg-white p-3 shadow-card dark:border-ink-700 dark:bg-ink-900" dir={isRTL ? "rtl" : "ltr"}>
          <p className="mb-2 text-title-sm text-ink-800 dark:text-ink-100">{label}</p>
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-body-sm">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-ink-600 dark:text-ink-300">{entry.name}:</span>
              <span className="font-mono font-medium text-ink-900 dark:text-white">{formatCurrency(entry.value, locale)}</span>
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
    <div ref={wrapperRef} className="h-[300px] w-full">
      <BarChart width={width} height={height} data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} horizontal={true} stroke="var(--ink-200)" opacity={0.5} />
        <XAxis dataKey="name" reversed={isRTL} axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-500)', fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-500)', fontSize: 12 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value} orientation={isRTL ? 'right' : 'left'} width={50} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--ink-50)', opacity: 0.4 }} />
        <Legend verticalAlign="top" height={36} iconType="circle" formatter={(value) => <span className={`text-ink-700 dark:text-ink-300 text-body-sm ${isRTL ? 'mr-1' : ''}`}>{value}</span>} />
        <Bar dataKey="payments" name={t("payments")} fill="#1f8a65" barSize={16} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" name={t("expenses")} fill="#cf2d56" barSize={16} radius={[4, 4, 0, 0]} />
      </BarChart>
    </div>
  );
}
