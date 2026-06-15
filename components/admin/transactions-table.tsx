"use client";

import { Link } from "@/i18n/routing";
import { encodeId } from "@/lib/id-utils";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Route } from "next";

type Transaction = {
  id: string;
  date: string;
  type: "payment" | "expense";
  amount: number;
  description: string;
  client_id: string;
  case_id: string | null;
  clients?: { name: string } | null;
  cases?: { title: string } | null;
  users?: { full_name?: string } | null;
};

export function TransactionsTable({
  transactions,
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
  return (
    <Card>
      <CardContent>
        <DataTable
          data={transactions}
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
              cell: (t: Transaction) => (
                <span className="text-ink-600 dark:text-ink-300">{t.users?.full_name || "Unknown"}</span>
              ),
            },
            {
              key: "type",
              header: t.columns_type,
              cell: (t: Transaction) => (
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
              ),
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
              cell: (t: Transaction) => (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    t.type === "payment" ? "text-success-700 dark:text-success-400" : "text-error-700 dark:text-error-400",
                  )}
                >
                  {t.type === "payment" ? "+" : "-"}
                  {formatCurrency(Number(t.amount), locale)}
                </span>
              ),
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}
