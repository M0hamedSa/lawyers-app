import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { Link } from "@/i18n/routing";
import { encodeId } from "@/lib/id-utils";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { TransactionSearch } from "@/components/admin/transaction-search";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
import { 
  IncomeExpenseBarChart, 
  TransactionDistributionChart 
} from "@/components/charts/transaction-charts";

export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; date?: string; type?: string }>;
}) {
  const { query, date, type } = await searchParams;
  const user = await getCurrentUser();
  
  if (user?.role !== "admin" && user?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  let dbQuery = supabase
    .from("transactions")
    .select("*, clients(name, profit), users!transactions_created_by_fkey(full_name)")
    .order("date", { ascending: false });

  if (user.role !== "superadmin") {
    dbQuery = dbQuery.eq("created_by", user.id);
  }

  if (date) dbQuery = dbQuery.eq('date', date);
  if (type === 'payment' || type === 'expense') {
    dbQuery = dbQuery.eq('type', type);
  }

  const { data: transactionsData, error: dbError } = await dbQuery;
  if (dbError) throw new Error(dbError.message);

  let transactions = transactionsData || [];
  if (query) {
    const q = query.toLowerCase();
    transactions = transactions.filter(t => 
      t.clients.name.toLowerCase().includes(q) || 
      (t.users?.full_name || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  }

  const locale = await getLocale();
  const t = await getTranslations("Transaction");
  const tCommon = await getTranslations("Common");
  const tAdmin = await getTranslations("Admin");
  const tCharts = await getTranslations("Charts");

  return (
    <div className="space-y-6">
      <div className="min-w-0 flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-700 dark:text-brass-400">
            {tAdmin("title")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
            {tAdmin("transactionsLog")}
          </h1>
        </div>
        <ExportTransactionsButton />
      </div>

      <TransactionSearch />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {tCharts("systemIncomeExpense")}
            </h3>
            <IncomeExpenseBarChart transactions={transactions} showPayments={user?.role === "superadmin"} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
              {tCharts("distribution")}
            </h3>
            <TransactionDistributionChart transactions={transactions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={transactions}
            empty={t("noResults")}
            getRowKey={(t) => t.id}
            columns={[
              {
                key: "date",
                header: t("columns.date"),
                cell: (t) => formatDate(t.date, locale),
              },
              {
                key: "client",
                header: "Client",
                cell: (t) => (
                  <Link
                    href={`/clients/${encodeId(t.client_id)}` as Route}
                    className="font-medium text-ink-900 underline-offset-2 hover:text-brass-700 hover:underline dark:text-ink-100 dark:hover:text-brass-400"
                  >
                    {t.clients.name}
                  </Link>
                ),
              },
              {
                key: "creator",
                header: "Made By",
                cell: (t) => (
                  <span className="text-ink-700 dark:text-ink-300">{t.users?.full_name || "Unknown"}</span>
                ),
              },
              {
                key: "type",
                header: t("columns.type"),
                cell: (t) => (
                  <span
                    className={cn(
                      "inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize",
                      t.type === "payment"
                        ? "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300"
                        : "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                    )}
                  >
                    {tCommon(t.type)}
                  </span>
                ),
              },
              {
                key: "description",
                header: t("columns.description"),
                cell: (t) => (
                  <span className="break-words text-ink-900 dark:text-ink-100">{t.description}</span>
                ),
              },
              {
                key: "amount",
                header: t("columns.amount"),
                className: "text-end",
                cell: (t) => (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      t.type === "payment"
                        ? "text-green-700 dark:text-green-400"
                        : "text-red-700 dark:text-red-400",
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
    </div>
  );
}
