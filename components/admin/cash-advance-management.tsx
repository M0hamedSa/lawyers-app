"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton } from "@/components/ui/action-button";
import { Modal } from "@/components/ui/modal";
import { useLocale, useTranslations } from "next-intl";
import { Users, Loader2, Download, Info, Edit2, Trash2, Plus } from "lucide-react";
import { inputClassName } from "@/components/ui/field";
import { CountUpNumber, FadeInBox } from "@/components/ui/animated";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

type Tab = "overview" | "log";

type UserFinancials = {
  id: string;
  full_name: string;
  role: string;
  cash_advance: number;
  total_expenses: number;
  balance: number;
};

type CashAdvanceRecord = {
  id: string;
  user_id: string;
  amount: number;
  description: string | null;
  date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  user_name: string;
};

type TeamMember = {
  id: string;
  full_name: string;
};

type AdvanceForm = {
  id?: string;
  user_id: string;
  amount: string;
  date: string;
  description: string;
};

const today = new Date().toISOString().slice(0, 10);
const emptyForm = (defaultUserId: string): AdvanceForm => ({
  user_id: defaultUserId,
  amount: "",
  date: today,
  description: "",
});

export function CashAdvanceManagement({
  initialUsers,
  initialAdvances,
  teamMembers,
}: {
  initialUsers: UserFinancials[];
  initialAdvances: CashAdvanceRecord[];
  teamMembers: TeamMember[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("CashAdvance");
  const tCommon = useTranslations("Common");
  const supabase = useMemo(() => createClient(), []);

  const [advances, setAdvances] = useState<CashAdvanceRecord[]>(initialAdvances);
  const [users, setUsers] = useState<UserFinancials[]>(initialUsers);

  // Modals and Forms
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultUser = teamMembers[0]?.id || "";
  const [form, setForm] = useState<AdvanceForm>(emptyForm(defaultUser));
  const [selectedAdvance, setSelectedAdvance] = useState<CashAdvanceRecord | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Sync state if server re-fetches
  useEffect(() => {
    setAdvances(initialAdvances);
  }, [initialAdvances]);

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Actions
  function openAdd() {
    setForm(emptyForm(defaultUser));
    setError(null);
    setModalOpen(true);
  }

  function openEdit(record: CashAdvanceRecord) {
    setForm({
      id: record.id,
      user_id: record.user_id,
      amount: record.amount.toString(),
      date: record.date,
      description: record.description || "",
    });
    setError(null);
    setModalOpen(true);
  }

  function openDelete(record: CashAdvanceRecord) {
    setSelectedAdvance(record);
    setError(null);
    setDeleteModalOpen(true);
  }

  async function saveAdvance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    const creatorId = userResult.user?.id;

    if (authError || !creatorId) {
      setError(tCommon("sessionError") || "User session not found.");
      setSubmitting(false);
      return;
    }

    const amountNum = parseFloat(form.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Amount must be greater than zero.");
      setSubmitting(false);
      return;
    }

    const payload = {
      user_id: form.user_id,
      amount: amountNum,
      date: form.date,
      description: form.description.trim() || null,
      created_by: creatorId,
    };

    if (form.id) {
      // Update
      const { data, error: updateError } = await supabase
        .from("cash_advances")
        .update(payload)
        .eq("id", form.id)
        .select("*, users!cash_advances_user_id_fkey(full_name)")
        .single();

      if (updateError) {
        setError(updateError.message);
      } else {
        const updated: CashAdvanceRecord = {
          ...data,
          user_name: data.users?.full_name || "-",
          amount: Number(data.amount)
        };
        setAdvances(prev => prev.map(a => a.id === form.id ? updated : a));
        setModalOpen(false);
        router.refresh();
      }
    } else {
      // Insert
      const { data, error: insertError } = await supabase
        .from("cash_advances")
        .insert(payload)
        .select("*, users!cash_advances_user_id_fkey(full_name)")
        .single();

      if (insertError) {
        setError(insertError.message);
      } else {
        const created: CashAdvanceRecord = {
          ...data,
          user_name: data.users?.full_name || "-",
          amount: Number(data.amount)
        };
        setAdvances(prev => [created, ...prev]);
        setModalOpen(false);
        router.refresh();
      }
    }
    setSubmitting(false);
  }

  async function deleteAdvance() {
    if (!selectedAdvance) return;
    setSubmitting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("cash_advances")
      .delete()
      .eq("id", selectedAdvance.id);

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setAdvances(prev => prev.filter(a => a.id !== selectedAdvance.id));
      setDeleteModalOpen(false);
      setSelectedAdvance(null);
      router.refresh();
    }
    setSubmitting(false);
  }

  // Export reports
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingLog, setIsExportingLog] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`/api/export-cash-advance?locale=${locale}`);

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export report");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = locale === 'ar' ? "تقرير_السلف.pdf" : "cash_advance_report.pdf";
      
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
      const msg = error instanceof Error ? error.message : "Failed to export report. Please try again.";
      setErrorMessage(locale === 'ar' ? `فشل تصدير التقرير: ${msg}` : `Failed to export report: ${msg}`);
      setErrorModalOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportLog = async () => {
    try {
      setIsExportingLog(true);
      const response = await fetch(`/api/export-cash-advance-log?locale=${locale}`);

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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to export report");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = locale === 'ar' ? "سجل_العهد_المالية.pdf" : "cash_advance_log_report.pdf";
      
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
      const msg = error instanceof Error ? error.message : "Failed to export report. Please try again.";
      setErrorMessage(locale === 'ar' ? `فشل تصدير التقرير: ${msg}` : `Failed to export report: ${msg}`);
      setErrorModalOpen(true);
    } finally {
      setIsExportingLog(false);
    }
  };

  const totalAdvances = users.reduce((sum, u) => sum + u.cash_advance, 0);
  const totalExpenses = users.reduce((sum, u) => sum + u.total_expenses, 0);
  const totalBalance = users.reduce((sum, u) => sum + u.balance, 0);

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-body-md text-ink-600 dark:text-ink-300">{t("totalAdvances")}</p>
            <h2 className="mt-2 text-xl font-normal tabular-nums text-success-700 dark:text-success-400 sm:text-2xl">
              <CountUpNumber value={totalAdvances} formatter={(v) => `${v.toLocaleString()} ${locale === "ar" ? "ج.م." : "EGP"}`} />
            </h2>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-body-md text-ink-600 dark:text-ink-300">{t("totalUserExpenses")}</p>
            <h2 className="mt-2 text-xl font-normal tabular-nums text-error-700 dark:text-error-400 sm:text-2xl">
              <CountUpNumber value={totalExpenses} formatter={(v) => `${v.toLocaleString()} ${locale === "ar" ? "ج.م." : "EGP"}`} />
            </h2>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="text-body-md text-ink-600 dark:text-ink-300">{t("netBalance")}</p>
            <h2 className="mt-2 text-xl font-normal tabular-nums text-ink-800 dark:text-ink-100 sm:text-2xl">
              <CountUpNumber value={totalBalance} formatter={(v) => `${v.toLocaleString()} ${locale === "ar" ? "ج.م." : "EGP"}`} />
            </h2>
          </CardContent>
        </Card>
      </div>

      <FadeInBox className="border-b border-ink-100 dark:border-ink-700">
        <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] sm:gap-2">
          {([
            ["overview", t("teamOverview")],
            ["log", t("reportTitle")],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-title-sm transition sm:px-4 sm:py-3",
                activeTab === tab
                  ? "border-accent-500 text-ink-800 dark:border-accent-400 dark:text-ink-100"
                  : "border-transparent text-ink-600 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </FadeInBox>

      {activeTab === "overview" && (
        <FadeInBox>
          <div className="flex justify-end items-center mb-4">
            <ActionButton onClick={handleExport} variant="secondary" disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="size-4 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />
              ) : (
                <Download className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
              )}
              {t("exportOverview")}
            </ActionButton>
          </div>

          <Card>
            <CardContent>
              <DataTable
                data={users}
                empty={t("noUsers")}
                getRowKey={(u) => u.id}
                columns={[
                  {
                    key: "full_name",
                    header: t("userName"),
                    cell: (u) => (
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400">
                          <Users className="size-4" />
                        </div>
                        <span className="font-medium text-ink-800 dark:text-ink-100">{u.full_name}</span>
                      </div>
                    ),
                  },
                  {
                    key: "cash_advance",
                    header: t("currentAdvance"),
                    cell: (u) => (
                      <span className="font-semibold tabular-nums text-success-700 dark:text-success-400">
                        {formatCurrency(u.cash_advance, locale)}
                      </span>
                    ),
                  },
                  {
                    key: "total_expenses",
                    header: t("totalExpenses"),
                    cell: (u) => (
                      <span className="font-medium tabular-nums text-error-700 dark:text-error-400">
                        {formatCurrency(u.total_expenses, locale)}
                      </span>
                    ),
                  },
                  {
                    key: "balance",
                    header: t("currentBalance"),
                    cell: (u) => (
                      <span className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                        {formatCurrency(u.balance, locale)}
                      </span>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </FadeInBox>
      )}

      {activeTab === "log" && (
        <FadeInBox>
          <div className="flex justify-end items-center mb-4 gap-2">
            <ActionButton onClick={handleExportLog} variant="secondary" disabled={isExportingLog}>
              {isExportingLog ? (
                <Loader2 className="size-4 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />
              ) : (
                <Download className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
              )}
              {t("exportLog")}
            </ActionButton>
            <ActionButton onClick={openAdd}>
              <Plus className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
              {t("addAdvance")}
            </ActionButton>
          </div>

          <Card>
            <CardContent>
              <DataTable
                data={advances}
                empty={t("noAdvances")}
                getRowKey={(a) => a.id}
                columns={[
                  {
                    key: "date",
                    header: t("date"),
                    cell: (a) => (
                      <span className="tabular-nums text-ink-500 dark:text-ink-400">
                        {formatDate(a.date, locale)}
                      </span>
                    ),
                  },
                  {
                    key: "user_name",
                    header: t("userName"),
                    cell: (a) => (
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                          <Users className="size-4" />
                        </div>
                        <span className="font-medium text-ink-800 dark:text-ink-100">{a.user_name}</span>
                      </div>
                    ),
                  },
                  {
                    key: "description",
                    header: t("description"),
                    cell: (a) => (
                      <span className="text-ink-800 dark:text-ink-100">
                        {a.description || "—"}
                      </span>
                    ),
                  },
                  {
                    key: "amount",
                    header: t("amount"),
                    cell: (a) => (
                      <span className="font-semibold tabular-nums text-success-700 dark:text-success-400">
                        {formatCurrency(a.amount, locale)}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: "",
                    className: "text-end",
                    cell: (a) => (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-accent-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-accent-400"
                          title={tCommon("edit")}
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDelete(a)}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-error-50 hover:text-error-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-error-900/20 dark:hover:text-error-400"
                          title={tCommon("delete")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
        </FadeInBox>
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={form.id ? t("editAdvance") : t("addAdvance")}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={saveAdvance} className="space-y-4 [&_input]:w-full [&_select]:w-full">
          <div>
            <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {t("selectUser")}
            </label>
            <select
              className={inputClassName}
              value={form.user_id}
              onChange={(e) => setForm(c => ({ ...c, user_id: e.target.value }))}
              required
              disabled={!!form.id}
            >
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                {t("amount")}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={inputClassName}
                value={form.amount}
                onChange={(e) => setForm(c => ({ ...c, amount: e.target.value }))}
                required
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                {t("date")}
              </label>
              <input
                type="date"
                className={inputClassName}
                value={form.date}
                onChange={(e) => setForm(c => ({ ...c, date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {t("description")}
            </label>
            <input
              type="text"
              className={inputClassName}
              value={form.description}
              onChange={(e) => setForm(c => ({ ...c, description: e.target.value }))}
            />
          </div>

          {error && (
            <div className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : tCommon("save")}
            </ActionButton>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title={t("deleteAdvance")}
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-600 dark:text-ink-400">
            {t("deleteConfirm")}
          </p>
          {error && (
            <div className="rounded-md border border-error-200 bg-error-50 p-3 text-sm text-error-800">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <ActionButton type="button" variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton
              type="button"
              className="bg-error-600 hover:bg-error-700 text-white"
              onClick={deleteAdvance}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : tCommon("delete")}
            </ActionButton>
          </div>
        </div>
      </Modal>

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
    </div>
  );
}
