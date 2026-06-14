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
import type { Metadata } from "next";

import { TransactionSearch } from "@/components/admin/transaction-search";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
import { FinanceMetric } from "@/components/ui/finance-metric";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tAdmin = await getTranslations("Admin");
  return { title: tAdmin("allTransactions") };
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; date?: string; type?: string; client_id?: string; case_id?: string }>;
}) {
  const { query, date, type, client_id, case_id } = await searchParams;
  const user = await getCurrentUser();

  if (user?.role !== "admin" && user?.role !== "superadmin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Fetch clients and cases for filter dropdowns
  const [clientsResult, casesResult] = await Promise.all([
    supabase.from("clients").select("id, name").order("name", { ascending: true }),
    supabase.from("cases").select("id, title, client_id").order("title", { ascending: true }),
  ]);

  const clientsList = clientsResult.data || [];
  const casesList = casesResult.data || [];

  // Build transactions query
  let dbQuery = supabase
    .from("transactions")
    .select("*, clients(name, profit), cases(title), users!transactions_created_by_fkey(full_name)")
    .order("date", { ascending: false });

  if (user.role !== "superadmin") {
    dbQuery = dbQuery.eq("created_by", user.id);
  }

  if (client_id) dbQuery = dbQuery.eq("client_id", client_id);
  if (case_id) dbQuery = dbQuery.eq("case_id", case_id);
  if (date) dbQuery = dbQuery.eq("date", date);
  if (type === "payment" || type === "expense") {
    dbQuery = dbQuery.eq("type", type);
  }

  const { data: transactionsData, error: dbError } = await dbQuery;
  if (dbError) throw new Error(dbError.message);

  let transactions = transactionsData || [];
  if (query) {
    const q = query.toLowerCase();
    transactions = transactions.filter(
      (t) =>
        (t.clients?.name || "").toLowerCase().includes(q) ||
        (t.users?.full_name || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.cases?.title || "").toLowerCase().includes(q),
    );
  }

  const locale = await getLocale();
  const t = await getTranslations("Transaction");
  const tCommon = await getTranslations("Common");
  const tAdmin = await getTranslations("Admin");
  const tCases = await getTranslations("Cases");
  const tClients = await getTranslations("Clients");

  const totalPayments = transactions.reduce((acc, t) => acc + (t.type === "payment" ? Number(t.amount) : 0), 0);
  const totalExpenses = transactions.reduce((acc, t) => acc + (t.type === "expense" ? Number(t.amount) : 0), 0);

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
        <ExportTransactionsButton clientId={client_id} caseId={case_id} />
      </div>

      <TransactionSearch clients={clientsList} cases={casesList} />

      {transactions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <FinanceMetric
            label={tAdmin("title") === "المسؤول" ? "إجمالي الدفعات" : "Total Payments"}
            value={formatCurrency(totalPayments, locale)}
            tone="payment"
          />
          <FinanceMetric
            label={tAdmin("title") === "المسؤول" ? "إجمالي المصروفات" : "Total Expenses"}
            value={formatCurrency(totalExpenses, locale)}
            tone="expense"
          />
          <FinanceMetric
            label={tCommon("balance")}
            value={formatCurrency(totalPayments - totalExpenses, locale)}
            tone="balance"
            rawValue={totalPayments - totalExpenses}
          />
        </div>
      )}

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
                header: tClients("columns.client"),
                cell: (t) => (
                  <Link
                    href={`/clients/${encodeId(t.client_id)}` as Route}
                    className="font-medium text-ink-900 underline-offset-2 hover:text-brass-700 hover:underline dark:text-ink-100 dark:hover:text-brass-400"
                  >
                    {t.clients?.name || "-"}
                  </Link>
                ),
              },
              {
                key: "case",
                header: tCases("title"),
                cell: (t) =>
                  t.case_id && t.cases?.title ? (
                    <Link
                      href={`/clients/${encodeId(t.client_id)}/cases/${encodeId(t.case_id)}` as Route}
                      className="text-sm font-medium text-ink-900 underline-offset-2 hover:text-brass-700 hover:underline dark:text-ink-100 dark:hover:text-brass-400"
                    >
                      {t.cases.title}
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-500">-</span>
                  ),
              },
              {
                key: "creator",
                header: tAdmin("title") === "المسؤول" ? "بواسطة" : "Made By",
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
                cell: (t) => <span className="break-words text-ink-900 dark:text-ink-100">{t.description}</span>,
              },
              {
                key: "amount",
                header: t("columns.amount"),
                className: "text-end",
                cell: (t) => (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      t.type === "payment" ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400",
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
