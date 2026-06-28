"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Info, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDebounce } from "use-debounce";
import type { Route } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton } from "@/components/ui/action-button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import { inputClassName } from "@/components/ui/field";

type OfficeTransaction = {
  id: string;
  date: string;
  amount: number;
  description: string;
  created_by: string | null;
  clients?: { name: string } | null;
  cases?: { title: string } | null;
  users?: { full_name?: string } | null;
};

export function OfficeTransactionsClient({
  transactions: initialTransactions,
  locale,
}: {
  transactions: OfficeTransaction[];
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [debouncedQuery] = useDebounce(query, 500);

  const [isExporting, setIsExporting] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const hasFilters = !!(query || dateFrom || dateTo);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    const newSearch = params.toString();
    if (newSearch !== searchParams.toString()) {
      router.push(`${pathname}?${newSearch}` as Route);
    }
  }, [debouncedQuery, dateFrom, dateTo, pathname, router, searchParams]);

  const clearFilters = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    router.push(pathname as Route);
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/export-office?locale=${locale}`);

      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const errData = await response.json();
        if (errData.error === "NO_DATA") {
          setErrorMessage(
            locale === "ar"
              ? "لا توجد بيانات متاحة لهذا التقرير."
              : "No data available for this report."
          );
          setErrorModalOpen(true);
          return;
        }
        throw new Error("Failed to export report");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export report");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename =
        locale === "ar" ? "تقرير_معاملات_المكتب.pdf" : "office_transactions_report.pdf";

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = decodeURIComponent(filenameMatch[1]);
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(error);
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to export report. Please try again.";
      setErrorMessage(
        locale === "ar"
          ? `فشل تصدير التقرير: ${msg}`
          : `Failed to export report: ${msg}`
      );
      setErrorModalOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  const tAdmin = useTranslations("Admin");
  const tTrans = useTranslations("Transaction");
  const tClients = useTranslations("Clients");
  const tCases = useTranslations("Cases");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:flex-1">
          {/* Search Input */}
          <div className="relative col-span-2 min-w-0 sm:flex-1" style={{ minWidth: "160px" }}>
            <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-400">
              <Search className="size-3.5" />
            </div>
            <input
              type="text"
              placeholder={tTrans("search")}
              className={`${inputClassName} ps-9 text-sm`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Date From */}
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <label htmlFor="dateFrom" className="whitespace-nowrap text-sm text-ink-600 dark:text-ink-300">
              {tTrans("fromDate")}
            </label>
            <input
              id="dateFrom"
              type="date"
              className={`${inputClassName} flex-1 text-sm sm:w-36 sm:flex-none`}
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
            <label htmlFor="dateTo" className="whitespace-nowrap text-sm text-ink-600 dark:text-ink-300">
              {tTrans("toDate")}
            </label>
            <input
              id="dateTo"
              type="date"
              className={`${inputClassName} flex-1 text-sm sm:w-36 sm:flex-none`}
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Clear Filters Button */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              title={tTrans("clearFilters")}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200 sm:col-span-1 sm:px-2"
            >
              <X className="size-4" />
              <span className="sm:hidden">{tTrans("clearFilters")}</span>
            </button>
          )}
        </div>

        <div className="shrink-0">
          <ActionButton
            onClick={handleExport}
            variant="secondary"
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="size-4 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />
            ) : (
              <Download className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
            )}
            {tAdmin("exportReport")}
          </ActionButton>
        </div>
      </div>

      <Card>
        <CardContent>
          <DataTable
            data={initialTransactions}
            empty={tTrans("noResults")}
            getRowKey={(t: OfficeTransaction) => t.id}
            columns={[
              {
                key: "date",
                header: tTrans("columns.date"),
                cell: (t: OfficeTransaction) => (
                  <span className="tabular-nums text-ink-500 dark:text-ink-400">
                    {formatDate(t.date, locale)}
                  </span>
                ),
              },
              {
                key: "client",
                header: tClients("columns.client"),
                cell: (t: OfficeTransaction) => (
                  <span className="font-medium text-ink-800 dark:text-ink-100">
                    {t.clients?.name || "-"}
                  </span>
                ),
              },
              {
                key: "case",
                header: tCases("title"),
                cell: (t: OfficeTransaction) => (
                  <span className="text-sm text-ink-800 dark:text-ink-100">
                    {t.cases?.title || "-"}
                  </span>
                ),
              },
              {
                key: "description",
                header: tTrans("columns.description"),
                cell: (t: OfficeTransaction) => (
                  <span className="text-ink-800 dark:text-ink-100">
                    {t.description}
                  </span>
                ),
              },
              {
                key: "created_by",
                header: tTrans("columns.createdBy"),
                cell: (t: OfficeTransaction) => (
                  <span className="text-ink-500 dark:text-ink-400">
                    {t.users?.full_name || "-"}
                  </span>
                ),
              },
              {
                key: "amount",
                header: tTrans("columns.amount"),
                className: "text-end",
                cell: (t: OfficeTransaction) => (
                  <span className="font-semibold tabular-nums text-error-700 dark:text-error-400">
                    -{formatCurrency(Number(t.amount), locale)}
                  </span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Modal
        title={locale === "ar" ? "تنبيه" : "Notice"}
        open={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <Info className="size-6" aria-hidden />
          </div>
          <p className="text-body-md text-ink-800 dark:text-ink-100">
            {errorMessage}
          </p>
          <ActionButton
            onClick={() => setErrorModalOpen(false)}
            className="mt-2 min-w-[120px]"
          >
            {locale === "ar" ? "حسناً" : "OK"}
          </ActionButton>
        </div>
      </Modal>
    </div>
  );
}
