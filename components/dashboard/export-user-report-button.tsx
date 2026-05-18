"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useLocale } from "next-intl";

export function ExportUserReportButton() {
  const [isExporting, setIsExporting] = useState(false);
  const locale = useLocale();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const url = new URL("/api/export-user-report", window.location.origin);
      url.searchParams.set("locale", locale);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to export dashboard report");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      const filename = locale === 'ar' ? "ملخص_لوحة_التحكم.pdf" : "dashboard_summary_report.pdf";
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
      className="inline-flex items-center gap-2 rounded-md border border-brass-600 bg-brass-50 px-4 py-2 text-sm font-semibold text-brass-800 shadow-sm hover:bg-brass-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-brass-700/50 dark:bg-brass-950/40 dark:text-brass-300 dark:hover:bg-brass-900/30"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {locale === 'ar' ? "تصدير تقرير الملخص" : "Export Summary Report"}
      </span>
    </button>
  );
}
