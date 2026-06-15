import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StaggerContainer } from "@/components/ui/animated";
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
  const tCommon = await getTranslations("Common");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-caption-uppercase uppercase text-accent-600 dark:text-accent-400">
            {t("title")}
          </p>
          <h1 className="mt-1 text-display-sm sm:text-display-lg text-ink-800 dark:text-ink-100">
            {t("title")}
          </h1>
        </div>
        <div className="shrink-0">
          <ExportUserReportButton />
        </div>
      </div>

      <StaggerContainer className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-4">
        <MetricCard tone="neutral" label={t("totalClients")} value={String(data.totalClients)} rawValue={data.totalClients} />
        {data.userRole === "superadmin" && (
          <MetricCard tone="payment" label={t("totalPayments")} value={formatCurrency(data.totalPayments, locale)} rawValue={data.totalPayments} />
        )}
        <MetricCard tone="expense" label={data.userRole === "superadmin" ? t("totalExpenses") : tCommon("myExpenses")} value={formatCurrency(data.totalExpenses, locale)} rawValue={data.totalExpenses} />
        <MetricCard tone="balance" label={data.userRole === "superadmin" ? t("totalBalance") : tCommon("balance")} value={formatCurrency(data.totalBalance, locale)} rawValue={data.totalBalance} />
      </StaggerContainer>
    </div>
  );
}
