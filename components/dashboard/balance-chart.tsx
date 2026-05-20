"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

export function BalanceChart({
  data,
  showPayments = true,
}: {
  data: { month: string; payments: number; expenses: number }[];
  showPayments?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("Charts");
  const tDashboard = useTranslations("Dashboard");
  const isRtl = locale.startsWith("ar");
  const [compact, setCompact] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    function update() {
      setCompact(!mq.matches);
    }
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-ink-100 text-sm text-ink-700 dark:border-ink-600 dark:text-ink-400 sm:h-72">
        {tDashboard("noTransactions")}
      </div>
    );
  }

  return (
    <div className="h-64 w-full min-w-0 px-0 pt-2 sm:h-80 sm:px-2 sm:pt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ 
            top: 10, 
            right: isRtl ? 85 : 10, 
            left: isRtl ? 10 : 85, 
            bottom: 0 
          }}
          barGap={compact ? 4 : 8}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="month"
            stroke="#9CA3AF"
            fontSize={compact ? 10 : 12}
            tickLine={false}
            axisLine={false}
            dy={8}
            reversed={isRtl}
            interval="preserveStartEnd"
          />
          <YAxis 
            fontSize={11} 
            tickLine={false} 
            axisLine={false} 
            width={compact ? 60 : 85}
            tickFormatter={(value) => formatCurrency(value, locale, true)}
            tick={{ fill: '#6b7280' }}
            orientation={isRtl ? "right" : "left"}
          />
          <Tooltip
            cursor={{ fill: "#F9FAFB", opacity: 0.4 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="rounded-lg border border-ink-100 bg-white/95 p-3 shadow-2xl backdrop-blur-sm dark:border-ink-700 dark:bg-ink-900/95">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-ink-500 dark:text-ink-400">{label}</p>
                    <div className="space-y-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {payload.map((entry: any) => (
                        <div key={entry.name} className="flex items-center justify-between gap-8 text-sm">
                          <div className="flex items-center gap-2">
                            <div 
                              className="size-2.5 rounded-sm" 
                              style={{ backgroundColor: entry.fill }} 
                            />
                            <span className="text-ink-600 font-medium dark:text-ink-300">{entry.name}</span>
                          </div>
                          <span className="font-bold text-ink-900 dark:text-ink-50">
                            {formatCurrency(entry.value, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="top"
            align="center"
            height={compact ? 28 : 36}
            iconType="square"
            iconSize={compact ? 8 : 10}
            wrapperStyle={{ fontSize: compact ? 9 : 11 }}
            formatter={(value) => (
              <span className={`font-bold uppercase tracking-wider text-ink-700 dark:text-ink-300 ${isRtl ? 'mr-1.5' : 'ml-1.5'}`}>
                {value}
              </span>
            )}
          />
          {showPayments && (
            <Bar
              dataKey="payments"
              name={t("payments")}
              fill="#10B981"
              radius={[3, 3, 0, 0]}
              barSize={compact ? 14 : 22}
            />
          )}
          <Bar
            dataKey="expenses"
            name={t("expenses")}
            fill="#EF4444"
            radius={[3, 3, 0, 0]}
            barSize={compact ? 14 : 22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
