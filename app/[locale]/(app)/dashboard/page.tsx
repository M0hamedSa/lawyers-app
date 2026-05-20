import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BalanceChart } from "@/components/dashboard/balance-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils";
import { ExportUserReportButton } from "@/components/dashboard/export-user-report-button";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Dashboard");
  return { title: t("title") };
}

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const data = await getDashboardData();
  const t = await getTranslations("Dashboard");
  const t_charts = await getTranslations("Charts");
  const tCommon = await getTranslations("Common");

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
        <MetricCard tone="neutral" label={t("totalClients")} value={String(data.totalClients)} rawValue={data.totalClients} />
        <MetricCard tone="balance" label={t("totalBalance")} value={formatCurrency(data.totalBalance, locale)} rawValue={data.totalBalance} />
        <MetricCard tone="payment" label={data.userRole === "superadmin" ? t("totalPayments") : tCommon("cashAdvance")} value={formatCurrency(data.totalPayments, locale)} rawValue={data.totalPayments} />
        <MetricCard tone="expense" label={data.userRole === "superadmin" ? t("totalExpenses") : tCommon("myExpenses")} value={formatCurrency(data.totalExpenses, locale)} rawValue={data.totalExpenses} />
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-sm font-semibold sm:text-base">{t_charts("paymentsVsExpenses")}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <BalanceChart data={data.chartData} showPayments={data.userRole === "superadmin"} />
        </CardContent>
      </Card>
    </div>
  );
}

import { cn } from "@/lib/utils";

function MetricCard({ 
  label, 
  value,
  tone,
  rawValue
}: { 
  label: string; 
  value: string;
  tone: "neutral" | "payment" | "expense" | "balance";
  rawValue: number;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <p className="text-[11px] font-normal text-ink-700 dark:text-ink-300 sm:text-sm truncate">{label}</p>
        <p 
          className={cn(
            "mt-1 sm:mt-2 break-words text-sm font-normal tabular-nums sm:text-2xl",
            tone === "neutral" && "text-ink-900 dark:text-ink-50",
            tone === "payment" && "text-green-700 dark:text-green-400",
            tone === "expense" && "text-red-700 dark:text-red-400",
            tone === "balance" && rawValue < 0 && "text-red-700 dark:text-red-400",
            tone === "balance" && rawValue >= 0 && "text-green-700 dark:text-green-400",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
