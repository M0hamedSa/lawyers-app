"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Plus, Loader2, Edit2, Trash2, X, UserPlus } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientWithSummary,
  CaseWithSummary,
  CasePriority,
  LedgerTransaction,
  TransactionType,
  VoucherType,
} from "@/lib/supabase/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
import { FilesTab } from "@/components/cases/files-tab";
import { StaggerContainer, FadeInBox, CountUpNumber } from "@/components/ui/animated";

type Tab = "finance" | "files";

type TransactionForm = {
  type: TransactionType;
  amount: string;
  description: string;
  voucher_type: VoucherType;
  date: string;
};

const today = new Date().toISOString().slice(0, 10);
const emptyTransaction: TransactionForm = {
  type: "payment",
  amount: "",
  description: "",
  voucher_type: "cash",
  date: today,
};

const voucherLabels: Record<VoucherType, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  receipt: "Receipt",
  card: "Card",
  other: "Other",
};

const priorityOrder: CasePriority[] = ["low", "medium", "high", "urgent"];

const priorityBadgeClasses: Record<CasePriority, string> = {
  low: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
};

export type TransactionWithUser = LedgerTransaction & { users?: { full_name: string } | null };

export function CaseDetailsClient({
  client,
  caseData,
  initialTransactions,
  currentUser,
  allUsers = [],
}: {
  client: ClientWithSummary;
  caseData: CaseWithSummary;
  initialTransactions: TransactionWithUser[];
  currentUser: { id: string; role: string; cash_advance: number; full_name?: string } | null;
  allUsers?: { id: string; full_name: string; role: string }[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tCommon = useTranslations("Common");
  const tTrans = useTranslations("Transaction");
  const locale = useLocale();

  const userRole = currentUser?.role || null;
  const userId = currentUser?.id;
  const superadminIds = useMemo(
    () => new Set(allUsers.filter((u) => u.role === "superadmin").map((u) => u.id)),
    [allUsers],
  );
  const [activeTab, setActiveTab] = useState<Tab>("finance");
  const [transactions, setTransactions] = useState<TransactionWithUser[]>(initialTransactions);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TransactionForm>({
    ...emptyTransaction,
    type: "expense"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deletedTransactionsRef = useRef(new Set<string>());
  const [caseStatus] = useState(caseData.status);
  // Lock all transactions if the case is closed OR the client is inactive
  const isLocked = caseStatus === "closed" || client.status === "inactive";

  const canManageAssignment = userRole === "admin" || userRole === "superadmin";
  const [priority, setPriority] = useState<CasePriority>(caseData.priority);
  const [assignees, setAssignees] = useState(caseData.assignees);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  async function updatePriority(next: CasePriority) {
    const previous = priority;
    setPriority(next);
    const { error: updateError } = await supabase.from("cases").update({ priority: next }).eq("id", caseData.id);
    if (updateError) setPriority(previous);
  }

  async function addAssignee(assigneeId: string) {
    if (!userId) return;
    const user = allUsers.find((u) => u.id === assigneeId);
    setAssignees((current) => [...current, { id: assigneeId, full_name: user?.full_name ?? "" }]);
    const { error: insertError } = await supabase
      .from("case_assignees")
      .insert({ case_id: caseData.id, user_id: assigneeId, assigned_by: userId });
    if (insertError) setAssignees((current) => current.filter((a) => a.id !== assigneeId));
  }

  async function removeAssignee(assigneeId: string) {
    const previous = assignees;
    setAssignees((current) => current.filter((a) => a.id !== assigneeId));
    const { error: deleteError } = await supabase
      .from("case_assignees")
      .delete()
      .eq("case_id", caseData.id)
      .eq("user_id", assigneeId);
    if (deleteError) setAssignees(previous);
  }

  // Sync state if server re-fetches (skip deleted IDs to prevent stale restore)
  useEffect(() => {
    setTransactions((current) => {
      const synced = initialTransactions.filter((t) => !deletedTransactionsRef.current.has(t.id));
      if (synced.length !== current.length || synced.some((t, i) => t.id !== current[i]?.id)) {
        return synced;
      }
      return current;
    });
  }, [initialTransactions]);

  useEffect(() => {
    const channel = supabase
      .channel(`case-ledger-${caseData.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `case_id=eq.${caseData.id}`,
        },
          (payload) => {
            if (payload.eventType === "INSERT") {
              const next = payload.new as LedgerTransaction;
              const withUser: TransactionWithUser = {
                ...next,
                users: { full_name: currentUser?.full_name ?? "" },
              };
              setTransactions((current) =>
                current.some((transaction) => transaction.id === next.id)
                  ? current
                  : [withUser, ...current],
              );
            }

            if (payload.eventType === "UPDATE") {
              const next = payload.new as LedgerTransaction;
              setTransactions((current) =>
                current.map((transaction) => (transaction.id === next.id ? next : transaction)),
              );
            }

          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<LedgerTransaction, "id">;
            deletedTransactionsRef.current.add(previous.id);
            setTransactions((current) =>
              current.filter((transaction) => transaction.id !== previous.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseData.id, supabase, currentUser]);

  const totals = transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === "payment") acc.payments += Number(transaction.amount);
      if (transaction.type === "expense") acc.expenses += Number(transaction.amount);
      return acc;
    },
    { payments: 0, expenses: 0 },
  );

  const myExpenses = transactions
    .filter((t) => t.type === "expense" && t.created_by === userId)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  let displayMyExpenses = 0;
  const displayTotalExpenses = totals.expenses;

  if (userRole !== "superadmin") {
    displayMyExpenses = myExpenses;
  }

  function openEditModal(transaction: TransactionWithUser) {
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      description: transaction.description,
      voucher_type: transaction.voucher_type,
      date: transaction.date,
    });
    setEditingId(transaction.id);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm({
      ...emptyTransaction,
      type: "expense",
    });
  }

  async function deleteTransaction(id: string) {
    setConfirmDelete(null);
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to delete");
        return;
      }
      deletedTransactionsRef.current.add(id);
      setTransactions((current) => current.filter((t) => t.id !== id));
    } catch {
      setError("Failed to delete transaction");
    } finally {
      setDeleting(null);
    }
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    if (!editingId && isLocked) {
      setSubmitting(false);
      setError(tCases("lockedCase") || "This case or client is closed. Transactions are not allowed.");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitting(false);
      setError("Amount must be greater than zero.");
      return;
    }

    if (editingId) {
      const res = await fetch(`/api/transactions/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          amount,
          description: form.description.trim(),
          voucher_type: form.voucher_type,
          date: form.date,
        }),
      });

      setSubmitting(false);

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to update");
        return;
      }

      const updated: TransactionWithUser = await res.json();
      setTransactions((current) =>
        current.map((t) => (t.id === updated.id ? updated : t)),
      );
      closeModal();
      router.refresh();
      return;
    }

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    const userId = userResult.user?.id;

    if (authError || !userId) {
      setError(tCommon("sessionError") || "User session not found. Please log in again.");
      setSubmitting(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("transactions")
      .insert({
        client_id: client.id,
        case_id: caseData.id,
        type: form.type,
        amount,
        description: form.description.trim(),
        voucher_type: form.voucher_type,
        date: form.date,
        created_by: userId,
      })
      .select("*, users!transactions_created_by_fkey(full_name)")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTransactions((current) => [data, ...current]);
    closeModal();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <FadeInBox>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link
            href={`/clients/${encodeId(client.id)}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-accent-700 dark:text-ink-300 dark:hover:text-accent-400"
          >
            <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
            {client.name}
          </Link>
          <h1 className="mt-3 break-words text-display-sm sm:text-display-md text-ink-800 dark:text-ink-100 sm:text-3xl">
            {caseData.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600 dark:text-ink-300">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              caseStatus === "open"
                ? "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400"
                : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-300",
            )}>
              {tCases("status." + caseStatus)}
            </span>
            {canManageAssignment ? (
              <select
                value={priority}
                onChange={(e) => updatePriority(e.target.value as CasePriority)}
                className={cn(
                  "cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium",
                  priorityBadgeClasses[priority],
                )}
              >
                {priorityOrder.map((p) => (
                  <option key={p} value={p}>
                    {tCases(`priority.${p}`)}
                  </option>
                ))}
              </select>
            ) : (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityBadgeClasses[priority])}>
                {tCases(`priority.${priority}`)}
              </span>
            )}
            {caseData.description && <span className="text-ink-400">· {caseData.description}</span>}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-ink-500 dark:text-ink-400">{tCases("assignedTo")}:</span>
            {assignees.length === 0 && !canManageAssignment && (
              <span className="text-ink-400">{tCases("unassigned")}</span>
            )}
            {assignees.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-full bg-ink-100 py-0.5 pe-1 ps-2.5 text-xs font-medium text-ink-700 dark:bg-ink-800 dark:text-ink-300"
              >
                {a.full_name}
                {canManageAssignment && (
                  <button
                    type="button"
                    onClick={() => removeAssignee(a.id)}
                    className="inline-flex size-4 items-center justify-center rounded-full text-ink-400 hover:bg-ink-200 hover:text-ink-700 dark:hover:bg-ink-700"
                    aria-label={tCommon("delete")}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {canManageAssignment && (
              <button
                type="button"
                onClick={() => setAssigneePickerOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-300 px-2 py-0.5 text-xs font-medium text-ink-500 hover:border-accent-400 hover:text-accent-600 dark:border-ink-600 dark:text-ink-400"
              >
                <UserPlus className="size-3" />
                {tCases("addAssignee")}
              </button>
            )}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col-reverse gap-2 sm:w-auto sm:flex-row-reverse">
          <ExportTransactionsButton clientId={client.id} caseId={caseData.id} />
          {!isLocked && (
            <ActionButton
              className="w-full shrink-0 sm:w-auto"
              onClick={() => {
                setActiveTab("finance");
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("addTransaction")}
            </ActionButton>
          )}
        </div>
      </div>
      </FadeInBox>

      {isLocked && (
        <FadeInBox delay={0.1}>
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="text-base">🔒</span>
          <span>
            {caseStatus === "closed"
              ? (tCases("lockedCase") || "This case is closed. No new transactions can be added.")
              : (tCases("lockedClient") || "This client is inactive. No new transactions can be added.")}
            {userRole === "superadmin" && " " + (tCases("lockedHint") || "You can reopen it by editing the case or client status.")}
          </span>
        </div>
      </FadeInBox>
      )}

      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <FinanceMetric label={t("totalExpenses")} value={formatCurrency(displayTotalExpenses, locale)} rawValue={displayTotalExpenses} tone="expense" locale={locale} />
        {userRole !== "superadmin" && (
          <FinanceMetric label={tCommon("myExpenses")} value={formatCurrency(displayMyExpenses, locale)} rawValue={displayMyExpenses} tone="expense" locale={locale} />
        )}
        {userRole === "superadmin" && client.profit_type === "per_case" && caseData.profit_amount ? (
          <FinanceMetric
            label={t("caseProfit") || "Case Profit"}
            value={formatCurrency(caseData.profit_amount, locale)}
            rawValue={caseData.profit_amount}
            tone="payment"
            locale={locale}
          />
        ) : null}
      </StaggerContainer>

      <FadeInBox delay={0.15}>
      <div className="border-b border-ink-100 dark:border-ink-700">
        <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] sm:gap-2">
          {([
            ["finance", t("finance")],
            ["files", t("files")],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-title-sm transition sm:px-4 sm:py-3",
                activeTab === tab
                  ? "border-accent-500 text-ink-800 dark:border-accent-400 dark:text-ink-50"
                  : "border-transparent text-ink-600 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      </FadeInBox>

      {error ? (
        <FadeInBox delay={0.2}>
        <div className="rounded-md border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-800 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
          {error}
        </div>
        </FadeInBox>
      ) : null}

      {activeTab === "finance" ? (
        <FadeInBox delay={0.2}>
        <FinanceTab
          transactions={transactions}
          userRole={userRole}
          currentUserId={userId}
          superadminIds={superadminIds}
          onEdit={openEditModal}
           onDelete={(id) => setConfirmDelete(id)}
          deleting={deleting}
        />
        </FadeInBox>
      ) : null}
      {activeTab === "files" ? (
        <FadeInBox delay={0.2}>
        <FilesTab caseId={caseData.id} />
        </FadeInBox>
      ) : null}

      <Modal title={editingId ? tTrans("editTransaction") : t("addTransaction")} open={modalOpen} onClose={closeModal}>
        <form onSubmit={saveTransaction} className="space-y-4 [&_input]:w-full [&_select]:w-full">

          <div className="space-y-1.5">
            <label className="text-title-sm text-ink-800 dark:text-ink-100">
              {tTrans("columns.type")}
            </label>
            <div className={cn("grid gap-2", form.type === "payment" ? "grid-cols-3" : "grid-cols-2")}>
              {userRole === "superadmin" && form.type === "payment" && (
                <label
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition",
                    form.type === "payment"
                      ? "border-success-500 bg-success-50 text-success-700 dark:border-success-500/50 dark:bg-success-500/10 dark:text-success-400"
                      : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value="payment"
                    className="sr-only"
                    checked={form.type === "payment"}
                    onChange={() => setForm((c) => ({ ...c, type: "payment" }))}
                  />
                  {tCommon("payment")}
                </label>
              )}
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition",
                  form.type === "expense"
                    ? "border-error-500 bg-error-50 text-error-700 dark:border-error-500/50 dark:bg-error-500/10 dark:text-error-400"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value="expense"
                  className="sr-only"
                  checked={form.type === "expense"}
                  onChange={() => setForm((c) => ({ ...c, type: "expense" }))}
                />
                {tCommon("expense")}
              </label>
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition",
                  form.type === "office"
                    ? "border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-500/50 dark:bg-accent-500/10 dark:text-accent-400"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value="office"
                  className="sr-only"
                  checked={form.type === "office"}
                  onChange={() => setForm((c) => ({ ...c, type: "office" }))}
                />
                {tCommon("office")}
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tTrans("columns.amount")}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className={inputClassName}
                value={form.amount}
                onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                placeholder="0.00"
              />
            </Field>
            <Field label={tTrans("columns.date")}>
              <input
                type="date"
                required
                className={inputClassName}
                value={form.date}
                onChange={(e) => setForm((c) => ({ ...c, date: e.target.value }))}
              />
            </Field>
          </div>

          <Field label={tTrans("columns.description")}>
            <input
              required
              className={inputClassName}
              value={form.description}
              onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            />
          </Field>

          <Field label={tTrans("voucherType")}>
            <select
              className={inputClassName}
              value={form.voucher_type}
              onChange={(e) => setForm((c) => ({ ...c, voucher_type: e.target.value as VoucherType }))}
            >
              {(Object.entries(voucherLabels) as [VoucherType, string][]).map(([val]) => (
                <option key={val} value={val}>
                  {tTrans(`vouchers.${val}`)}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <ActionButton type="button" variant="secondary" onClick={closeModal}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tTrans("saveTransaction")
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal title={tTrans("deleteTransaction")} open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <div className="space-y-5">
          <p className="text-body-md text-ink-700 dark:text-ink-300">
            {tTrans("deleteConfirm")}
          </p>
          {error && (
            <div className="rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="border border-ink-200 bg-white text-ink-800 rounded-md h-10 px-[18px] text-btn"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={deleting === confirmDelete}
              onClick={() => deleteTransaction(confirmDelete!)}
              className="bg-error-600 hover:bg-error-700 text-white rounded-md h-10 px-[18px] text-btn inline-flex items-center gap-2"
            >
              {deleting === confirmDelete ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {tCommon("delete")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title={tCases("form.assignees")} open={assigneePickerOpen} onClose={() => setAssigneePickerOpen(false)}>
        <div className="space-y-4">
          <div className="max-h-64 overflow-y-auto rounded-md border border-ink-100 dark:border-ink-700">
            <div className="divide-y divide-ink-50 dark:divide-ink-700">
              {allUsers
                .filter((u) => !assignees.some((a) => a.id === u.id))
                .map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-2 p-2.5 hover:bg-ink-50 dark:hover:bg-ink-800">
                    <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{u.full_name}</span>
                    <button
                      type="button"
                      onClick={() => addAssignee(u.id)}
                      className="rounded-md px-3 py-1 text-xs font-semibold bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-900/20 dark:text-success-400"
                    >
                      {tCases("addAssignee")}
                    </button>
                  </div>
                ))}
              {allUsers.filter((u) => !assignees.some((a) => a.id === u.id)).length === 0 && (
                <p className="p-4 text-center text-sm text-ink-400">{tCases("unassigned")}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <ActionButton onClick={() => setAssigneePickerOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FinanceMetric({ label, value, tone, rawValue, locale = "en-US" }: { label: string; value: string; tone: "payment" | "expense" | "balance"; rawValue?: number; locale?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <p className="text-caption-uppercase uppercase text-ink-600 dark:text-ink-300">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 sm:mt-2 truncate text-display-sm tabular-nums sm:text-2xl",
            tone === "payment" && "text-success-700 dark:text-success-400",
            tone === "expense" && "text-error-700 dark:text-error-400",
            tone === "balance" && "text-ink-800 dark:text-ink-100",
          )}
        >
          {rawValue !== undefined ? (
            <CountUpNumber value={rawValue} formatter={(v) => formatCurrency(v, locale)} />
          ) : (
            value
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function FinanceTab({
  transactions,
  userRole,
  currentUserId,
  superadminIds,
  onEdit,
  onDelete,
  deleting,
}: {
  transactions: TransactionWithUser[];
  userRole: string | null;
  currentUserId?: string;
  superadminIds?: Set<string>;
  onEdit: (item: TransactionWithUser) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  const t = useTranslations("ClientDetails");
  const tTrans = useTranslations("Transaction");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  function canModify(item: TransactionWithUser) {
    if (userRole === "superadmin") return true;
    if (userRole === "admin") {
      return item.type !== "system" && !superadminIds?.has(item.created_by ?? "");
    }
    return item.created_by === currentUserId;
  }

  const getVoucherColor = (voucher?: string | null) => {
    switch (voucher) {
      case "cash": return "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400";
      case "bank_transfer": return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400";
      case "receipt": return "bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400";
      case "card": return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-500";
      case "other": return "bg-stone-100 text-stone-700 dark:bg-stone-800/40 dark:text-stone-400";
      default: return "bg-ink-100 text-ink-700 dark:bg-ink-800/40 dark:text-ink-400";
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-ink-100 py-3 dark:border-ink-800 dark:bg-ink-950/20 sm:py-4">
        <CardTitle className="text-sm sm:text-base">{t("financialLedger")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          data={transactions}
          empty={t("emptyLedger")}
          getRowKey={(t) => t.id}
          columns={[
            {
              key: "date",
              header: tTrans("columns.date"),
              cell: (item) => <span className="tabular-nums text-ink-500 dark:text-ink-400">{formatDate(item.date, locale)}</span>,
            },
            {
              key: "type",
              header: tTrans("columns.type"),
              cell: (item) => {
                if (item.type === "profit") {
                  return (
                    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[10px] sm:text-xs font-semibold capitalize bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {locale === "ar" ? "اتعاب" : "Profit"}
                    </span>
                  );
                }
                if (item.type === "office") {
                  return (
                    <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[10px] sm:text-xs font-semibold capitalize bg-accent-50 text-accent-800 dark:bg-accent-950/50 dark:text-accent-300">
                      {tCommon("office")}
                    </span>
                  );
                }
                return (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-2 py-1 text-[10px] sm:text-xs font-semibold capitalize",
                      item.type === "payment" || item.type === "system"
                        ? "bg-success-50 text-success-800 dark:bg-success-950/50 dark:text-success-300"
                        : "bg-error-50 text-error-800 dark:bg-error-950/50 dark:text-error-300",
                    )}
                  >
                    {tCommon(item.type)}
                  </span>
                );
              },
            },
            {
              key: "voucher_type",
              header: tTrans("columns.voucher"),
              cell: (item) => (
                <span
                  className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
                    getVoucherColor(item.voucher_type)
                  )}
                >
                  {item.voucher_type ? tTrans("vouchers." + item.voucher_type) : "-"}
                </span>
              ),
            },
            {
              key: "description",
              header: tTrans("columns.description"),
              cell: (item) => <span className="font-medium text-ink-800 dark:text-ink-100">{item.description}</span>,
            },
            {
              key: "amount",
              header: tTrans("columns.amount"),
              cell: (item) => (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    item.type === "payment" || item.type === "system" ? "text-success-700 dark:text-success-400" : "text-error-700 dark:text-error-400",
                  )}
                >
                  {item.type === "payment" || item.type === "system" ? "+" : "-"}
                  {formatCurrency(item.amount, locale)}
                </span>
              ),
            },
            {
              key: "created_by",
              header: tTrans("columns.createdBy"),
              cell: (item: TransactionWithUser) => (
                <span className="text-ink-500 dark:text-ink-400">
                  {item.users?.full_name || "-"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-end",
              cell: (item: TransactionWithUser) => {
                if (!canModify(item)) return null;
                const isDeleting = deleting === item.id;
                return (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-accent-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-accent-400"
                      aria-label={tCommon("edit")}
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => onDelete(item.id)}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-error-50 hover:text-error-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-error-900/20 dark:hover:text-error-400"
                      aria-label={tCommon("delete")}
                    >
                      {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      </CardContent>
    </Card>
  );
}


