import { getTranslations } from "next-intl/server";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils";
import { ExportUserReportButton } from "@/components/dashboard/export-user-report-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getDashboardData();
  const t = await getTranslations("Dashboard");
  const t_charts = await getTranslations("Charts");

  return (
    <div className="space-y-5">
      {/* Header aligned inline on small screens */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brass-700 dark:text-brass-400 sm:text-sm">
            {t("title")}
          </p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
            {t("title")}
          </h1>
        </div>
        <div className="shrink-0">
          <ExportUserReportButton />
        </div>
      </div>

      {/* Grid displays as 2x2 on mobile, 4 columns on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("totalClients")} value={String(data.totalClients)} />
        <MetricCard label={t("totalBalance")} value={formatCurrency(data.totalBalance, locale)} />
        <MetricCard label={data.userRole === "superadmin" ? t("totalPayments") : "Cash Advance"} value={formatCurrency(data.totalPayments, locale)} />
        <MetricCard label={data.userRole === "superadmin" ? t("totalExpenses") : "My Expenses"} value={formatCurrency(data.totalExpenses, locale)} />
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-sm font-semibold sm:text-base">{locale === 'ar' ? t_charts("incomeExpense") : "Payments vs Expenses over time"}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <BalanceChart data={data.chartData} showPayments={data.userRole === "superadmin"} />
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3.5 sm:p-6">
        <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400 sm:text-sm truncate">{label}</p>
        <p className="mt-1 break-words text-sm font-bold tabular-nums text-ink-900 dark:text-ink-50 sm:text-2xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
