"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CountUpNumber } from "@/components/ui/animated";
import { cn, formatCurrency } from "@/lib/utils";

export function FinanceMetric({
  label,
  value,
  tone,
  rawValue,
  locale = "en-US",
}: {
  label: string;
  value: string;
  tone: "payment" | "expense" | "balance";
  rawValue?: number;
  locale?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <p className="text-caption-uppercase uppercase text-ink-600 dark:text-ink-400">{label}</p>
        <p
          className={cn(
            "mt-2 break-words text-display-sm tabular-nums sm:text-display-md",
            tone === "payment" && "text-success-500 dark:text-success-400",
            tone === "expense" && "text-error-500 dark:text-error-400",
            tone === "balance" && "text-ink-800 dark:text-ink-50",
          )}
        >
          {rawValue !== undefined ? (
            <CountUpNumber value={rawValue} formatter={(v) => formatCurrency(v, locale)} />
          ) : (
            value
          )}
        </p>
      </CardContent>
    </Card>
  );
}
