"use client";

import { useState } from "react";
import { Download, Eye, Loader2, Info } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { ActionButton } from "@/components/ui/action-button";

export function ExportCasesButton({ clientId }: { clientId: string }) {
  const [exportingMode, setExportingMode] = useState<"download" | "view" | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const t = useTranslations("Admin");
  const locale = useLocale();

  const handleExport = async (mode: "download" | "view" = "download") => {
    try {
      setExportingMode(mode);
      const url = new URL("/api/export-client-cases", window.location.origin);
      url.searchParams.set("locale", locale);
      url.searchParams.set("client_id", clientId);

      const response = await fetch(url.toString());

      // Check for NO_DATA signal (returned as 200 + JSON to avoid console errors)
      const contentType = response.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const errData = await response.json();
        if (errData.error === "NO_DATA") {
          setErrorMessage(locale === 'ar' ? "لا توجد مهام متاحة لهذا العميل." : "No cases available for this client.");
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
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      
      if (mode === "view") {
        window.open(downloadUrl, "_blank");
        setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 60000);
      } else {
        const a = document.createElement("a");
        a.href = downloadUrl;
        
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = locale === 'ar' ? "تقرير_المهام.pdf" : "cases_report.pdf";
        
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
      }
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Failed to export report. Please try again.";
      setErrorMessage(locale === 'ar' ? `فشل تصدير التقرير: ${msg}` : `Failed to export report: ${msg}`);
      setErrorModalOpen(true);
    } finally {
      setExportingMode(null);
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        <button 
          onClick={() => handleExport("view")} 
          disabled={exportingMode !== null}
          title={locale === 'ar' ? "عرض التقرير" : "View Report"}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100 dark:hover:bg-ink-950"
        >
          {exportingMode === "view" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4 text-ink-600 dark:text-ink-400" />
          )}
          <span>{locale === 'ar' ? "عرض" : "View"}</span>
        </button>

        <button 
          onClick={() => handleExport("download")} 
          disabled={exportingMode !== null}
          title={locale === 'ar' ? "تنزيل التقرير" : "Download Report"}
          className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-ink-800 dark:bg-ink-950 dark:text-ink-100 dark:hover:bg-ink-950"
        >
          {exportingMode === "download" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span>{t("exportReport")}</span>
        </button>
      </div>

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
