"use client";

import { useState } from "react";
import { Download, Loader2, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";

export function ExportTransactionsButton({ clientId, caseId }: { clientId?: string; caseId?: string }) {
  const [isExporting, setIsExporting] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const searchParams = useSearchParams();
  const t = useTranslations("Admin");
  const locale = useLocale();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const url = new URL("/api/export-transactions", window.location.origin);
      
      const query = searchParams.get("query");
      if (query) url.searchParams.set("query", query);
      
      const date = searchParams.get("date");
      if (date) url.searchParams.set("date", date);

      const type = searchParams.get("type");
      if (type) url.searchParams.set("type", type);

      url.searchParams.set("locale", locale);

      if (clientId) {
        url.searchParams.set("client_id", clientId);
      }

      if (caseId) {
        url.searchParams.set("case_id", caseId);
      }

      const response = await fetch(url.toString());

      // Check for NO_DATA signal (returned as 200 + JSON to avoid console errors)
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const errData = await response.json();
        if (errData.error === "NO_DATA") {
          setErrorMessage(locale === 'ar' ? "لا توجد بيانات متاحة لهذا التقرير." : "No data available for this report.");
          setErrorModalOpen(true);
          return;
        }
        throw new Error("Failed to export report");
      }

      if (!response.ok) throw new Error("Failed to export report");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = locale === 'ar' ? "تقرير_المعاملات.pdf" : "transactions_report.pdf";
      
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
      setErrorMessage(locale === 'ar' ? "فشل تصدير التقرير. يرجى المحاولة مرة أخرى." : "Failed to export report. Please try again.");
      setErrorModalOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <button 
        onClick={handleExport} 
        disabled={isExporting}
        className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100 dark:hover:bg-ink-950"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {t("exportReport")}
      </button>

      <Modal 
        title={locale === 'ar' ? "تنبيه" : "Notice"} 
        open={errorModalOpen} 
        onClose={() => setErrorModalOpen(false)}
      >
        <div className="flex flex-col items-center justify-center gap-4 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
            <Info className="size-6" aria-hidden />
          </div>
          <p className="text-body-md text-ink-800 dark:text-ink-100">{errorMessage}</p>
          <ActionButton onClick={() => setErrorModalOpen(false)} className="mt-2 min-w-[120px]">
            {locale === 'ar' ? "حسناً" : "OK"}
          </ActionButton>
        </div>
      </Modal>
    </>
  );
}
