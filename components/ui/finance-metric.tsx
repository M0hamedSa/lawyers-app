import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FinanceMetric({
  label,
  value,
  tone,
  rawValue = 0,
}: {
  label: string;
  value: string;
  tone: "payment" | "expense" | "balance";
  rawValue?: number;
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <p className="text-sm font-normal text-ink-700 dark:text-ink-300">{label}</p>
        <p
          className={cn(
            "mt-2 break-words text-xl font-normal tabular-nums sm:text-2xl",
            tone === "payment" && "text-green-700 dark:text-green-400",
            tone === "expense" && "text-red-700 dark:text-red-400",
            tone === "balance" && "text-ink-900 dark:text-ink-50",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
