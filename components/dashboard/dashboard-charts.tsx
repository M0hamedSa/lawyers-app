"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { TopClientsChart } from "@/components/charts/top-clients-chart";
import { VoucherTypeChart } from "@/components/charts/voucher-type-chart";
import { ClientBreakdownChart } from "@/components/charts/client-breakdown-chart";
import { Card } from "@/components/ui/card";
import { ActionButton } from "@/components/ui/action-button";
import { StaggerContainer, FadeInBox } from "@/components/ui/animated";

type ChartPreferences = {
  cashFlow: boolean;
  topClients: boolean;
  clientBreakdown: boolean;
  voucherTypes: boolean;
  incomeExpense: boolean;
};

const DEFAULT_PREFS: ChartPreferences = {
  cashFlow: true,
  topClients: true,
  clientBreakdown: true,
  voucherTypes: true,
  incomeExpense: true,
};

export function DashboardCharts({ chartData, locale, userRole }: { chartData: Record<string, unknown>; locale: string; userRole: string | null }) {
  const t = useTranslations("Charts");
  const tVouchers = useTranslations("Transaction.vouchers");
  const [prefs, setPrefs] = useState<ChartPreferences>(DEFAULT_PREFS);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("true_legal_chart_prefs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      } catch {
        // ignore
      }
    }
  }, []);

  const togglePref = (key: keyof ChartPreferences) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    localStorage.setItem("true_legal_chart_prefs", JSON.stringify(newPrefs));
  };

  const hasVisibleCharts = Object.values(prefs).some(Boolean);

  const voucherData = ((chartData.voucherTypes as Array<{ name: string; value: number }>) || []).map(v => ({
    name: tVouchers(v.name) || v.name,
    value: v.value
  }));

  const incomeExpenseData = ((chartData.incomeExpenseRatio as Array<{ name: string; value: number }>) || []).map(v => ({
    name: v.name === "Payments" ? t("payments") : v.name === "Expenses" ? t("expenses") : v.name,
    value: v.value,
    color: v.name === "Payments" ? "#1f8a65" : v.name === "Expenses" ? "#cf2d56" : undefined
  }));

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-title-md text-ink-800 dark:text-ink-100">{t("customize")}</h2>
        <div className="relative">
          <ActionButton 
            variant="secondary" 
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2"
          >
            <Settings2 className="h-4 w-4" />
            <span>{t("showHide")}</span>
          </ActionButton>
          
          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-md border border-ink-200 bg-white p-2 shadow-dropdown dark:border-ink-800 dark:bg-ink-950 rtl:left-0 rtl:right-auto">
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                <input 
                  type="checkbox" 
                  checked={prefs.cashFlow} 
                  onChange={() => togglePref("cashFlow")} 
                  className="rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-ink-700 dark:text-ink-200">{t("cashFlow")}</span>
              </label>
              {userRole === "superadmin" && (
                <>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                    <input 
                      type="checkbox" 
                      checked={prefs.topClients} 
                      onChange={() => togglePref("topClients")} 
                      className="rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                    />
                    <span className="text-ink-700 dark:text-ink-200">{t("topClients")}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                    <input 
                      type="checkbox" 
                      checked={prefs.clientBreakdown} 
                      onChange={() => togglePref("clientBreakdown")} 
                      className="rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                    />
                    <span className="text-ink-700 dark:text-ink-200">{t("clientBreakdown")}</span>
                  </label>
                </>
              )}
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                <input 
                  type="checkbox" 
                  checked={prefs.voucherTypes} 
                  onChange={() => togglePref("voucherTypes")} 
                  className="rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-ink-700 dark:text-ink-200">{t("voucherTypes")}</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-body-sm hover:bg-ink-50 dark:hover:bg-ink-900">
                <input 
                  type="checkbox" 
                  checked={prefs.incomeExpense} 
                  onChange={() => togglePref("incomeExpense")} 
                  className="rounded border-ink-300 text-accent-500 focus:ring-accent-500"
                />
                <span className="text-ink-700 dark:text-ink-200">{t("incomeExpense")}</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {hasVisibleCharts && (
        <StaggerContainer className="grid gap-5 md:grid-cols-2">
          {prefs.cashFlow && (
            <FadeInBox className="col-span-1 md:col-span-2">
              <Card className="p-5">
                <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{t("cashFlow")}</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <CashFlowChart data={chartData.cashFlow as any[]} locale={locale} />
              </Card>
            </FadeInBox>
          )}

          {prefs.clientBreakdown && userRole === "superadmin" && (
            <FadeInBox className="col-span-1 md:col-span-2">
              <Card className="p-5">
                <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{t("clientBreakdown")}</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <ClientBreakdownChart data={chartData.clientFinancials as any[]} locale={locale} />
              </Card>
            </FadeInBox>
          )}

          {prefs.voucherTypes && (
            <FadeInBox className="col-span-1">
              <Card className="p-5">
                <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{t("voucherTypes")}</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <VoucherTypeChart data={voucherData as any[]} locale={locale} />
              </Card>
            </FadeInBox>
          )}

          {prefs.incomeExpense && (
            <FadeInBox className="col-span-1 md:col-span-2 lg:col-span-1">
              <Card className="p-5">
                <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{t("incomeExpense")}</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <VoucherTypeChart data={incomeExpenseData as any[]} locale={locale} />
              </Card>
            </FadeInBox>
          )}

          {prefs.topClients && userRole === "superadmin" && (
            <FadeInBox className="col-span-1 md:col-span-2">
              <Card className="p-5">
                <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{t("topClients")}</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <TopClientsChart data={chartData.topClients as any[]} locale={locale} />
              </Card>
            </FadeInBox>
          )}
        </StaggerContainer>
      )}
    </div>
  );
}
