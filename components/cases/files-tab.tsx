"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText, Loader2, Trash2, Download, Upload, AlertCircle, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { CaseFile } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { CASE_UPLOADS_BUCKET, MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/case-uploads";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FilesTab({ caseId }: { caseId: string }) {
  const t = useTranslations("ClientDetails");
  const supabase = useMemo(() => createClient(), []);

  const [files, setFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/files`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("listError"));
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("listError"));
    } finally {
      setLoading(false);
    }
  }, [caseId, t]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new Error(t("fileTooLarge", { max: MAX_UPLOAD_MB }));
      }

      // Upload straight to Supabase Storage (Vercel caps request bodies at
      // 4.5 MB), then have the server move the staged file to Mega.
      const urlRes = await fetch(`/api/cases/${caseId}/files/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: file.size }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        throw new Error(
          urlData.error === "FILE_TOO_LARGE"
            ? t("fileTooLarge", { max: MAX_UPLOAD_MB })
            : urlData.error || t("uploadError"),
        );
      }

      const { error: stageError } = await supabase.storage
        .from(CASE_UPLOADS_BUCKET)
        .uploadToSignedUrl(urlData.path, urlData.token, file, {
          contentType: file.type || "application/octet-stream",
        });
      if (stageError) throw new Error(stageError.message || t("uploadError"));

      const res = await fetch(`/api/cases/${caseId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: urlData.path, filename: file.name, mimeType: file.type }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("uploadError"));

      setFiles((prev) => [data.file, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm(t("deleteFileConfirm"))) return;

    setDeleting(fileId);
    setError(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/files/${fileId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("deleteError"));

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("deleteError"));
    } finally {
      setDeleting(null);
    }
  }

  function handleView(file: CaseFile) {
    window.open(`/api/cases/${caseId}/files/${file.id}/download`, "_blank");
  }

  function handleDownload(file: CaseFile) {
    window.open(`/api/cases/${caseId}/files/${file.id}/download?download=1`, "_blank");
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="size-6 animate-spin text-ink-400" />
        </CardContent>
      </Card>
    );
  }

  if (error === "MEGA_NOT_CONFIGURED") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            <AlertCircle className="size-6" />
          </div>
          <p className="text-body-md text-ink-500 dark:text-ink-400">{t("megaNotConfigured")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-title-md text-ink-800 dark:text-ink-100">{t("files")}</h3>
          <label className={cn(
            "flex cursor-pointer items-center gap-2 rounded-md bg-accent-500 px-[18px] py-2.5 text-btn text-white transition-colors hover:bg-accent-600",
            uploading && "pointer-events-none opacity-60",
          )}>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploading ? t("uploading") : t("uploadFile")}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        {error && error !== "MEGA_NOT_CONFIGURED" && (
          <div className="mb-4 rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
            {error}
          </div>
        )}

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
              <FileText className="size-6" />
            </div>
            <p className="text-body-md text-ink-500 dark:text-ink-400">{t("noFiles")}</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-100 dark:divide-ink-800">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 py-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-md font-medium text-ink-800 dark:text-ink-100">
                    {file.filename}
                  </p>
                  <p className="text-body-sm text-ink-500 dark:text-ink-400">
                    {formatFileSize(file.file_size)} &middot; {formatDate(file.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleView(file)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm text-accent-600 transition-colors hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-950/30"
                  title="View"
                >
                  <Eye className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm text-accent-600 transition-colors hover:bg-accent-50 dark:text-accent-400 dark:hover:bg-accent-950/30"
                  title="Download"
                >
                  <Download className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(file.id)}
                  disabled={deleting === file.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-body-sm text-error-600 transition-colors hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-950/30 disabled:opacity-50"
                >
                  {deleting === file.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
