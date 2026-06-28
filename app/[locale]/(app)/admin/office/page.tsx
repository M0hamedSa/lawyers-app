import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { FinanceMetric } from "@/components/ui/finance-metric";
import { OfficeTransactionsClient } from "@/components/admin/office-transactions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tAdmin = await getTranslations({ locale, namespace: "Admin" });
  return { title: tAdmin("officeTransactions") };
}

export default async function AdminOfficePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ query?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const { locale } = await params;
  const { query, dateFrom, dateTo } = await searchParams;
  const currentUser = await getCurrentUser();

  if (currentUser?.role !== "superadmin") {
    redirect({ href: "/dashboard", locale: locale as "en" | "ar" });
  }

  const supabase = await createClient();

  let dbQuery = supabase
    .from("transactions")
    .select("*, clients(name), cases(title), users!transactions_created_by_fkey(full_name)")
    .eq("type", "office")
    .order("date", { ascending: false });

  if (dateFrom) dbQuery = dbQuery.gte("date", dateFrom);
  if (dateTo) dbQuery = dbQuery.lte("date", dateTo);

  const { data: transactionsData, error } = await dbQuery;

  if (error) throw new Error(error.message);

  let transactions = transactionsData || [];
  if (query) {
    const q = query.toLowerCase();
    transactions = transactions.filter(
      (t) =>
        (t.clients?.name || "").toLowerCase().includes(q) ||
        (t.users?.full_name || "").toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        (t.cases?.title || "").toLowerCase().includes(q)
    );
  }

  const tAdmin = await getTranslations("Admin");

  const totalOffice = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-caption-uppercase uppercase text-accent-700 dark:text-accent-400">
          {tAdmin("officeTransactions")}
        </p>
        <h1 className="mt-1 text-display-sm text-ink-800 dark:text-ink-100 sm:text-3xl">
          {tAdmin("officeTransactionsLog")}
        </h1>
      </div>

      {transactions.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <FinanceMetric
            label={tAdmin("totalOffice")}
            value={formatCurrency(totalOffice, locale as string)}
            tone="expense"
            rawValue={totalOffice}
            locale={locale as string}
          />
        </div>
      )}

      <OfficeTransactionsClient
        transactions={transactions || []}
        locale={locale as string}
      />
    </div>
  );
}
