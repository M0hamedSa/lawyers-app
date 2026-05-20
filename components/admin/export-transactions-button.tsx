"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

export function ExportTransactionsButton({ clientId }: { clientId?: string }) {
  const [isExporting, setIsExporting] = useState(false);
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

      const response = await fetch(url.toString());
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
      alert(locale === 'ar' ? "فشل تصدير التقرير. يرجى المحاولة مرة أخرى." : "Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button 
      onClick={handleExport} 
      disabled={isExporting}
      className="inline-flex items-center gap-2 rounded-md border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 shadow-sm hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-ink-800 dark:bg-ink-950 dark:text-ink-50 dark:hover:bg-ink-900"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {t("exportReport")}
    </button>
  );
}
