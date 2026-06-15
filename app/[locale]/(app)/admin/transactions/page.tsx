import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { Metadata } from "next";

import { TransactionSearch } from "@/components/admin/transaction-search";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
import { FinanceMetric } from "@/components/ui/finance-metric";
import { TransactionsTable } from "@/components/admin/transactions-table";

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

  // Extract all translation strings for the client component
  const tTable = {
    noResults: t("noResults"),
    columns_date: t("columns.date"),
    columns_type: t("columns.type"),
    columns_description: t("columns.description"),
    columns_amount: t("columns.amount"),
  };
  const tCommonTable = {
    payment: tCommon("payment"),
    expense: tCommon("expense"),
    balance: tCommon("balance"),
  };
  const tAdminTable = {
    title: tAdmin("title"),
    transactionsLog: tAdmin("transactionsLog"),
  };
  const tCasesTable = {
    title: tCases("title"),
  };
  const tClientsTable = {
    columns_client: tClients("columns.client"),
  };

  const totalPayments = transactions.reduce((acc, t) => acc + (t.type === "payment" ? Number(t.amount) : 0), 0);
  const totalExpenses = transactions.reduce((acc, t) => acc + (t.type === "expense" ? Number(t.amount) : 0), 0);

  return (
    <div className="space-y-6">
      <div className="min-w-0 flex items-end justify-between">
        <div>
          <p className="text-caption-uppercase uppercase text-accent-700 dark:text-accent-400">
            {tAdminTable.title}
          </p>
          <h1 className="mt-1 text-display-sm text-ink-800 dark:text-ink-100 sm:text-3xl">
            {tAdminTable.transactionsLog}
          </h1>
        </div>
        <ExportTransactionsButton clientId={client_id} caseId={case_id} />
      </div>

      <TransactionSearch clients={clientsList} cases={casesList} />

      {transactions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <FinanceMetric
            label={tAdminTable.title === "المسؤول" ? "إجمالي الدفعات" : "Total Payments"}
            value={formatCurrency(totalPayments, locale)}
            tone="payment"
            rawValue={totalPayments}
            locale={locale}
          />
          <FinanceMetric
            label={tAdminTable.title === "المسؤول" ? "إجمالي المصروفات" : "Total Expenses"}
            value={formatCurrency(totalExpenses, locale)}
            tone="expense"
            rawValue={totalExpenses}
            locale={locale}
          />
          <FinanceMetric
            label={tCommonTable.balance}
            value={formatCurrency(totalPayments - totalExpenses, locale)}
            tone="balance"
            rawValue={totalPayments - totalExpenses}
            locale={locale}
          />
        </div>
      )}

      <TransactionsTable
        transactions={transactions}
        locale={locale}
        t={tTable}
        tCommon={tCommonTable}
        tAdmin={tAdminTable}
        tCases={tCasesTable}
        tClients={tClientsTable}
      />
    </div>
  );
}
