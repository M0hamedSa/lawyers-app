"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { encodeId } from "@/lib/id-utils";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Route } from "next";
import { Trash2, Loader2 } from "lucide-react";

type Transaction = {
  id: string;
  date: string;
  type: "payment" | "expense" | "profit" | "office";
  amount: number;
  description: string;
  client_id: string;
  case_id: string | null;
  clients?: { name: string } | null;
  cases?: { title: string } | null;
  users?: { full_name?: string } | null;
};

export function TransactionsTable({
  transactions: initialTransactions,
  locale,
  t,
  tCommon,
  tAdmin,
  tCases,
  tClients,
}: {
  transactions: Transaction[];
  locale: string;
  t: Record<string, string>;
  tCommon: Record<string, string>;
  tAdmin: Record<string, string>;
  tCases: Record<string, string>;
  tClients: Record<string, string>;
}) {
  const [data, setData] = useState(initialTransactions);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    setData(initialTransactions);
  }, [initialTransactions]);

  async function handleDelete(id: string) {
    if (!window.confirm(tAdmin.title === "المسؤول" ? "هل أنت متأكد من حذف هذه المعاملة؟" : "Delete this transaction?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        console.error(err.error);
        return;
      }
      setData((current) => current.filter((item) => item.id !== id));
    } catch {
      console.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Card>
      <CardContent>
        <DataTable
          data={data}
          empty={t.noResults}
          getRowKey={(t: Transaction) => t.id}
          columns={[
            {
              key: "date",
              header: t.columns_date,
              cell: (t: Transaction) => formatDate(t.date, locale),
            },
            {
              key: "client",
              header: tClients.columns_client,
              cell: (t: Transaction) => (
                <Link
                  href={`/clients/${encodeId(t.client_id)}` as Route}
                  className="font-medium text-ink-800 underline-offset-2 hover:text-accent-700 hover:underline dark:text-ink-100 dark:hover:text-accent-400"
                >
                  {t.clients?.name || "-"}
                </Link>
              ),
            },
            {
              key: "case",
              header: tCases.title,
              cell: (t: Transaction) =>
                t.case_id && t.cases?.title ? (
                  <Link
                    href={`/clients/${encodeId(t.client_id)}/cases/${encodeId(t.case_id)}` as Route}
                    className="text-sm font-medium text-ink-800 underline-offset-2 hover:text-accent-700 hover:underline dark:text-ink-100 dark:hover:text-accent-400"
                  >
                    {t.cases.title}
                  </Link>
                ) : (
                  <span className="text-sm text-ink-500">-</span>
                ),
            },
            {
              key: "creator",
              header: tAdmin.title === "المسؤول" ? "بواسطة" : "Made By",
              cell: (t: Transaction) => {
                if (t.type === "profit") {
                  return <span className="text-ink-600 dark:text-ink-300">{tAdmin.title === "المسؤول" ? "النظام" : "System"}</span>;
                }
                return <span className="text-ink-600 dark:text-ink-300">{t.users?.full_name || "Unknown"}</span>;
              },
            },
            {
              key: "type",
              header: t.columns_type,
              cell: (t: Transaction) => {
                if (t.type === "profit") {
                  return (
                    <span className="inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {tAdmin.title === "المسؤول" ? "أرباح" : "Profit"}
                    </span>
                  );
                }
                if (t.type === "office") {
                  return (
                    <span className="inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize bg-accent-50 text-accent-800 dark:bg-accent-950/50 dark:text-accent-300">
                      {tCommon.office}
                    </span>
                  );
                }
                return (
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize",
                      t.type === "payment"
                        ? "bg-success-50 text-success-800 dark:bg-success-950/50 dark:text-success-300"
                        : "bg-error-50 text-error-800 dark:bg-error-950/50 dark:text-error-300",
                    )}
                  >
                    {tCommon[t.type]}
                  </span>
                );
              },
            },
            {
              key: "description",
              header: t.columns_description,
              cell: (t: Transaction) => <span className="break-words text-ink-800 dark:text-ink-100">{t.description}</span>,
            },
            {
              key: "amount",
              header: t.columns_amount,
              className: "text-end",
              cell: (t: Transaction) => {
                const isProfit = t.type === "profit";
                const isPayment = t.type === "payment";
                const isPositive = isPayment || isProfit;
                return (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      isProfit 
                        ? "text-blue-700 dark:text-blue-400" 
                        : isPayment 
                          ? "text-success-700 dark:text-success-400" 
                          : "text-error-700 dark:text-error-400",
                    )}
                  >
                    {isPositive ? "+" : "-"}
                    {formatCurrency(Number(t.amount), locale)}
                  </span>
                );
              },
            },
            {
              key: "actions",
              header: "",
              className: "text-end",
              cell: (t: Transaction) => {
                if (t.type === "profit") return null;
                const isDeleting = deleting === t.id;
                return (
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => handleDelete(t.id)}
                    className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-error-50 hover:text-error-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-error-900/20 dark:hover:text-error-400"
                    aria-label="Delete"
                  >
                    {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </button>
                );
              },
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
