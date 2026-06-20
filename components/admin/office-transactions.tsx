"use client";

import { useState } from "react";
import { Download, Loader2, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton } from "@/components/ui/action-button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  const [isExporting, setIsExporting] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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
      <div className="flex justify-end">
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
