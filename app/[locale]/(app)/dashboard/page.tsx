import { getTranslations } from "next-intl/server";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getDashboardData();
  const t = await getTranslations("Dashboard");
  const t_charts = await getTranslations("Charts");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brass-700 dark:text-brass-400">
          {t("title")}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
          {t("title")}
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("totalClients")} value={String(data.totalClients)} />
        <MetricCard label={t("totalBalance")} value={formatCurrency(data.totalBalance, locale)} />
        <MetricCard label={data.userRole === "superadmin" ? t("totalPayments") : "Cash Advance"} value={formatCurrency(data.totalPayments, locale)} />
        <MetricCard label={data.userRole === "superadmin" ? t("totalExpenses") : "My Expenses"} value={formatCurrency(data.totalExpenses, locale)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{locale === 'ar' ? t_charts("incomeExpense") : "Payments vs Expenses over time"}</CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={data.chartData} showPayments={data.userRole === "superadmin"} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-ink-700 dark:text-ink-300">{label}</p>
        <p className="mt-2 break-words text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-50 sm:text-2xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
