"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Edit2, Trash2, Download, Eye, FileText, Plus, Loader2, RotateCcw, X, UserPlus } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientWithSummary,
  CaseWithSummary,
  CaseFile,
  CasePriority,
  LedgerTransaction,
  VoucherType,
} from "@/lib/supabase/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";
import { ExportCasesButton } from "@/components/clients/export-cases-button";
import { FadeInBox, StaggerContainer, CountUpNumber } from "@/components/ui/animated";
import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import { ClientBreakdownChart } from "@/components/charts/client-breakdown-chart";

type Tab = "overview" | "cases" | "finance" | "files";

type CaseForm = {
  id?: string;
  title: string;
  description: string;
  status: string;
  priority: CasePriority;
  profit_amount: string;
  assignee_ids: string[];
};

const emptyCase: CaseForm = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  profit_amount: "",
  assignee_ids: [],
};

const priorityOrder: CasePriority[] = ["low", "medium", "high", "urgent"];

const priorityBadgeClasses: Record<CasePriority, string> = {
  low: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
};

type CashFlowPoint = { month: string; payments: number; expenses: number };
type CaseBreakdownPoint = { name: string; payments: number; expenses: number };

export type TransactionWithUserAndCase = LedgerTransaction & { 
  users?: { full_name: string } | null;
  cases?: { title: string } | null;
};

type PaymentForm = {
  amount: string;
  description: string;
  voucher_type: VoucherType;
  date: string;
};

const today = new Date().toISOString().slice(0, 10);
const emptyPayment: PaymentForm = {
  amount: "",
  description: "",
  voucher_type: "cash",
  date: today,
};

export function ClientDetailsClient({
  client,
  initialCases,
  initialTransactions = [],
  currentUser,
  userGlobalBalance,
  cashFlowData = [],
  caseBreakdownData = [],
  allUsers = [],
}: {
  client: ClientWithSummary;
  initialCases: CaseWithSummary[];
  initialTransactions?: TransactionWithUserAndCase[];
  currentUser: { id: string; role: string; cash_advance: number; full_name?: string } | null;
  userGlobalBalance?: number;
  cashFlowData?: CashFlowPoint[];
  caseBreakdownData?: CaseBreakdownPoint[];
  allUsers?: { id: string; full_name: string; role: string }[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const superadminIds = useMemo(
    () => new Set(allUsers.filter((u) => u.role === "superadmin").map((u) => u.id)),
    [allUsers],
  );
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tCommon = useTranslations("Common");
  const tTrans = useTranslations("Transaction");
  const tClients = useTranslations("Clients");
  const locale = useLocale();

  const userRole = currentUser?.role || null;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [cases, setCases] = useState(initialCases);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [form, setForm] = useState<CaseForm>(emptyCase);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPayment);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);
  const [confirmDeleteTransaction, setConfirmDeleteTransaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deletedCasesRef = useRef(new Set<string>());
  const deletedTransactionsRef = useRef(new Set<string>());

  useEffect(() => {
    const channel = supabase
      .channel(`client-cases-${client.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cases",
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as Record<string, unknown>;
            setCases((current) =>
              current.some((c) => c.id === next.id)
                ? current
                : [
                    {
                      id: next.id as string,
                      client_id: next.client_id as string,
                      title: next.title as string,
                      description: (next.description as string) ?? null,
                      status: next.status as string,
                      priority: (next.priority as CasePriority) ?? "medium",
                      profit_amount: next.profit_amount != null ? Number(next.profit_amount) : null,
                      created_by: (next.created_by as string) ?? null,
                      created_at: next.created_at as string,
                      updated_at: next.updated_at as string,
                      total_payments: 0,
                      total_expenses: 0,
                      balance: 0,
                      assignees: [],
                    },
                    ...current,
                  ],
            );
          }
          if (payload.eventType === "UPDATE") {
            const next = payload.new as Record<string, unknown>;
            setCases((current) =>
              current.map((c) =>
                c.id === next.id
                  ? { ...c, title: next.title as string, description: (next.description as string) ?? null, status: next.status as string, profit_amount: next.profit_amount != null ? Number(next.profit_amount) : null, updated_at: next.updated_at as string }
                  : c,
              ),
            );
          }
          if (payload.eventType === "DELETE") {
            const previous = payload.old as Record<string, unknown>;
            deletedCasesRef.current.add(previous.id as string);
            setCases((current) => current.filter((c) => c.id !== previous.id));
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client.id, supabase]);

  // Sync state if server re-fetches (skip deleted IDs to prevent stale restore)
  useEffect(() => {
    setCases((current) => {
      const synced = initialCases.filter((c) => !deletedCasesRef.current.has(c.id));
      if (synced.length !== current.length || synced.some((c, i) => c.id !== current[i]?.id)) {
        return synced;
      }
      return current;
    });
  }, [initialCases]);
  // Sync transactions state if server re-fetches
  useEffect(() => {
    setTransactions((current) => {
      const synced = initialTransactions.filter((t) => !deletedTransactionsRef.current.has(t.id));
      if (synced.length !== current.length || synced.some((t, i) => t.id !== current[i]?.id)) {
        return synced;
      }
      return current;
    });
  }, [initialTransactions]);

  const caseTotals = cases.reduce(
    (acc, c) => {
      if (c.status !== "closed") {
        acc.profit += c.profit_amount ?? 0;
      }
      return acc;
    },
    { profit: 0 }
  );

  const txTotals = transactions.reduce(
    (acc, t) => {
      if (userRole !== "superadmin" && t.created_by !== currentUser?.id) {
        return acc;
      }
      // Exclude transactions belonging to closed cases
      if (t.case_id) {
        const relatedCase = cases.find((c) => c.id === t.case_id);
        if (relatedCase && relatedCase.status === "closed") {
          return acc;
        }
      }
      
      if (t.type === "profit") {
        acc.profit += Number(t.amount);
      } else {
        if (t.type === "payment" && !t.is_cleared) acc.payments += Number(t.amount);
        if (t.type === "expense") acc.expenses += Number(t.amount);
      }
      return acc;
    },
    { payments: 0, expenses: 0, profit: 0 }
  );

  const totals = {
    payments: txTotals.payments,
    expenses: txTotals.expenses,
    profit: client.profit_type === "monthly" ? txTotals.profit : caseTotals.profit,
  };

  let balance = 0;
  let displayPayments = 0;
  const displayExpenses = totals.expenses;

  if (userRole === "superadmin") {
    displayPayments = totals.payments;
    balance = displayPayments - displayExpenses;
  } else {
    displayPayments = currentUser?.cash_advance || 0;
    balance = userGlobalBalance !== undefined ? userGlobalBalance : displayPayments - displayExpenses;
  }

  async function handleResetPayments() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/reset-payments`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset payments");
      
      setTransactions((current) => 
        current.map(t => t.type === "payment" && !t.is_cleared ? { ...t, is_cleared: true } : t)
      );
      setResetModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error resetting payments");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    const userId = userResult.user?.id;

    if (authError || !userId) {
      setError(tCommon("sessionError") || "User session not found. Please log in again.");
      setSubmitting(false);
      return;
    }

    const payload = {
      client_id: client.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status,
      priority: form.priority,
      profit_amount: client.profit_type === "per_case" ? (form.profit_amount ? Number(form.profit_amount) : 0) : 0,
    };

    let result;
    if (form.id) {
       result = await supabase.from("cases").update(payload).eq("id", form.id).select().single();
    } else {
       result = await supabase.from("cases").insert({ ...payload, created_by: userId }).select().single();
    }

    if (result.error) {
      setSubmitting(false);
      setError(result.error.message);
      return;
    }

    const caseId = result.data.id as string;

    if (userRole === "admin" || userRole === "superadmin") {
      const existingIds = form.id
        ? cases.find((c) => c.id === form.id)?.assignees.map((a) => a.id) ?? []
        : [];
      const toAdd = form.assignee_ids.filter((id) => !existingIds.includes(id));
      const toRemove = existingIds.filter((id) => !form.assignee_ids.includes(id));

      if (toAdd.length > 0) {
        await supabase
          .from("case_assignees")
          .insert(toAdd.map((uid) => ({ case_id: caseId, user_id: uid, assigned_by: userId })));
      }
      if (toRemove.length > 0) {
        await supabase
          .from("case_assignees")
          .delete()
          .eq("case_id", caseId)
          .in("user_id", toRemove);
      }
    }

    setSubmitting(false);

    const assignees = form.assignee_ids.map((uid) => ({
      id: uid,
      full_name: allUsers.find((u) => u.id === uid)?.full_name ?? "",
    }));

    if (form.id) {
      setCases((current) =>
        current.map((c) =>
          c.id === form.id ? { ...c, ...payload, assignees, updated_at: result.data.updated_at } : c
        )
      );
    } else {
      setCases((current) => [
        {
          ...result.data,
          total_payments: 0,
          total_expenses: 0,
          balance: 0,
          assignees,
        },
        ...current,
      ]);
    }

    setForm(emptyCase);
    setModalOpen(false);
    router.refresh();
  }

  async function deleteCase(id: string) {
    setConfirmDelete(null);
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Failed to delete");
        return;
      }
      deletedCasesRef.current.add(id);
      setCases((current) => current.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete case");
    } finally {
      setDeleting(null);
    }
  }

  async function deleteTransaction(id: string) {
    setConfirmDeleteTransaction(null);
    setDeletingTransaction(id);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Failed to delete");
        return;
      }
      deletedTransactionsRef.current.add(id);
      setTransactions((current) => current.filter((t) => t.id !== id));
    } catch {
      setError("Failed to delete transaction");
    } finally {
      setDeletingTransaction(null);
    }
  }

  async function savePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    const userId = userResult.user?.id;

    if (authError || !userId) {
      setError(tCommon("sessionError") || "User session not found. Please log in again.");
      setSubmitting(false);
      return;
    }

    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitting(false);
      setError("Amount must be greater than zero.");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("transactions")
      .insert({
        client_id: client.id,
        case_id: null,
        type: "payment",
        amount,
        description: paymentForm.description.trim(),
        voucher_type: paymentForm.voucher_type,
        date: paymentForm.date,
        created_by: userId,
      })
      .select("*, cases(title), users!transactions_created_by_fkey(full_name)")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTransactions((current) => [data, ...current]);
    setPaymentModalOpen(false);
    setPaymentForm(emptyPayment);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <FadeInBox>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <Link
              href="/clients"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-accent-700 dark:text-ink-300 dark:hover:text-accent-400"
            >
              <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
              {useTranslations("Clients")("title")}
            </Link>
            <h1 className="mt-3 break-words text-display-sm sm:text-display-md text-ink-800 dark:text-ink-100 sm:text-3xl">
              {client.name}
            </h1>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              {client.phone || tCommon("noPhone")} · {client.email || tCommon("noEmail")}
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col-reverse gap-2 sm:w-auto sm:flex-row-reverse">
            <ExportCasesButton clientId={client.id} />
            
            {userRole === "superadmin" && client.status === "active" && (
              <ActionButton
                variant="secondary"
                className="w-full shrink-0 sm:w-auto text-error-600 hover:text-error-700 hover:border-error-300 dark:text-error-400 dark:hover:text-error-300"
                onClick={() => setResetModalOpen(true)}
              >
                <RotateCcw className="size-4" aria-hidden />
                {tClients("resetPayments") || "Reset Payments"}
              </ActionButton>
            )}

            <ActionButton
              className="w-full shrink-0 sm:w-auto"
              onClick={() => {
                setActiveTab("cases");
                setForm(emptyCase);
                setModalOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {tCases("newCase")}
            </ActionButton>
            
            {userRole === "superadmin" && client.status === "active" && (
              <ActionButton
                className="w-full shrink-0 sm:w-auto"
                onClick={() => {
                  setPaymentForm(emptyPayment);
                  setPaymentModalOpen(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                {tCommon("payment")}
              </ActionButton>
            )}
          </div>
        </div>
      </FadeInBox>

      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {userRole === "superadmin" && (
          <FinanceMetric label={t("totalPayments") || "Total Payments"} value={formatCurrency(totals.payments, locale)} rawValue={totals.payments} tone="payment" locale={locale} />
        )}
        <FinanceMetric label={userRole === "superadmin" ? t("totalExpenses") : tCommon("myExpenses")} value={formatCurrency(displayExpenses, locale)} rawValue={displayExpenses} tone="expense" locale={locale} />
        <FinanceMetric label={t("currentBalance")} value={formatCurrency(balance, locale)} rawValue={balance} tone="balance" locale={locale} />
        {userRole === "superadmin" && client.profit_type === "monthly" ? (
          <>
            <FinanceMetric
              label={t("totalProfit") || "Total Profit"}
              value={formatCurrency(totals.profit, locale)}
              rawValue={totals.profit}
              tone="payment"
              locale={locale}
            />
            <FinanceMetric
              label={locale === "ar" ? "صافي الحساب" : "Net Balance"}
              value={formatCurrency(balance - totals.profit, locale)}
              rawValue={balance - totals.profit}
              tone="balance"
              locale={locale}
            />
          </>
        ) : null}
        {userRole === "superadmin" && client.profit_type === "per_case" && totals.profit > 0 ? (
          <>
            <FinanceMetric
              label={t("totalProfit") || "Total Profit"}
              value={formatCurrency(totals.profit, locale)}
              rawValue={totals.profit}
              tone="payment"
              locale={locale}
            />
            <FinanceMetric
              label={locale === "ar" ? "صافي الحساب" : "Net Balance"}
              value={formatCurrency(balance - totals.profit, locale)}
              rawValue={balance - totals.profit}
              tone="balance"
              locale={locale}
            />
          </>
        ) : null}
      </StaggerContainer>

      <FadeInBox className="border-b border-ink-100 dark:border-ink-700">
        <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] sm:gap-2">
          {([
            ["overview", t("overview")],
            ["cases", tCases("title")],
            ["finance", t("finance") || "Finance"],
            ["files", t("files")],
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

      {error ? (
        <div className="rounded-md border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-800 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
          {error}
        </div>
      ) : null}

      {activeTab === "overview" ? (
          <OverviewTab
            client={client}
            casesCount={cases.length}
            cashFlowData={cashFlowData}
            caseBreakdownData={caseBreakdownData}
            userRole={userRole}
          />
      ) : null}
      {activeTab === "cases" ? (
        <CasesTab cases={cases} userRole={userRole} client={client} currentUserId={currentUser?.id} onEdit={(c) => {
          setForm({
            id: c.id,
            title: c.title,
            description: c.description || "",
            status: c.status,
            priority: c.priority,
            profit_amount: c.profit_amount ? String(c.profit_amount) : "",
            assignee_ids: c.assignees.map((a) => a.id),
          });
          setModalOpen(true);
        }} onDelete={(id) => setConfirmDelete(id)} deleting={deleting} />
      ) : null}
      {activeTab === "finance" ? (
        <FadeInBox delay={0.2}>
          <FinanceTab
            transactions={transactions}
            userRole={userRole}
            currentUserId={currentUser?.id}
            superadminIds={superadminIds}
            onDelete={(id) => setConfirmDeleteTransaction(id)}
            deleting={deletingTransaction}
          />
        </FadeInBox>
      ) : null}
      {activeTab === "files" ? <FilesTab clientId={client.id} /> : null}

      <Modal title={tCommon("payment")} open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)}>
        <form onSubmit={savePayment} className="space-y-4 [&_input]:w-full [&_select]:w-full">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tCommon("amount")}>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className={inputClassName}
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm((c) => ({ ...c, amount: e.target.value }))}
                placeholder="0.00"
              />
            </Field>
            <Field label={tCommon("date")}>
              <input
                type="date"
                required
                className={inputClassName}
                value={paymentForm.date}
                onChange={(e) => setPaymentForm((c) => ({ ...c, date: e.target.value }))}
              />
            </Field>
          </div>

          <Field label={tCommon("description")}>
            <input
              required
              className={inputClassName}
              value={paymentForm.description}
              onChange={(e) => setPaymentForm((c) => ({ ...c, description: e.target.value }))}
            />
          </Field>

          <Field label={useTranslations("Transaction")("voucherType")}>
            <select
              className={inputClassName}
              value={paymentForm.voucher_type}
              onChange={(e) => setPaymentForm((c) => ({ ...c, voucher_type: e.target.value as VoucherType }))}
            >
              <option value="cash">{useTranslations("Transaction")("vouchers.cash")}</option>
              <option value="bank_transfer">{useTranslations("Transaction")("vouchers.bank_transfer")}</option>
              <option value="receipt">{useTranslations("Transaction")("vouchers.receipt")}</option>
              <option value="card">{useTranslations("Transaction")("vouchers.card")}</option>
              <option value="other">{useTranslations("Transaction")("vouchers.other")}</option>
            </select>
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCommon("save")
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title={tClients("resetPayments") || "Reset Payments"}>
        <div className="p-4 sm:p-6">
          <p className="mb-6 text-body-md text-ink-700 dark:text-ink-300">
            {tClients("resetPaymentsConfirm") || "Are you sure you want to mark all current payments as done and reset the counter to zero?"}
          </p>
          <div className="flex justify-end gap-3">
            <ActionButton type="button" variant="secondary" onClick={() => setResetModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="button" variant="danger" disabled={submitting} onClick={handleResetPayments}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tClients("resetPayments") || "Reset Payments"
              )}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal title={form.id ? tCases("editCase") : tCases("newCase")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveCase} className="space-y-4 [&_input]:w-full [&_select]:w-full">
          <Field label={tCases("form.title")}>
            <input
              required
              className={inputClassName}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          
          {client.profit_type === "per_case" && userRole === "superadmin" && (
            <Field label={tCases("form.profitAmount")}>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClassName}
                value={form.profit_amount}
                onChange={(event) => setForm((current) => ({ ...current, profit_amount: event.target.value }))}
              />
            </Field>
          )}

          <Field label={tCases("form.description")}>
            <textarea
              className={textareaClassName}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tCases("columns.status")}>
              <select
                className={inputClassName}
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="open">{tCases("status.open")}</option>
                <option value="closed">{tCases("status.closed")}</option>
              </select>
            </Field>

            <Field label={tCases("form.priority")}>
              <select
                className={inputClassName}
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as CasePriority }))}
              >
                {priorityOrder.map((p) => (
                  <option key={p} value={p}>
                    {tCases(`priority.${p}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {(userRole === "admin" || userRole === "superadmin") && (
            <div className="space-y-2">
              <label className="text-title-sm text-ink-800 dark:text-ink-100">{tCases("form.assignees")}</label>

              {form.assignee_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.assignee_ids.map((id) => {
                    const u = allUsers.find((user) => user.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-accent-50 py-1 ps-3 pe-1 text-xs font-medium text-accent-700 dark:bg-accent-950/30 dark:text-accent-400"
                      >
                        {u?.full_name ?? ""}
                        <button
                          type="button"
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              assignee_ids: current.assignee_ids.filter((assigneeId) => assigneeId !== id),
                            }))
                          }
                          className="inline-flex size-4 items-center justify-center rounded-full text-accent-500 hover:bg-accent-100 hover:text-accent-800 dark:hover:bg-accent-900/40"
                          aria-label={tCommon("delete")}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="max-h-40 overflow-y-auto rounded-md border border-ink-100 dark:border-ink-700">
                <div className="divide-y divide-ink-50 dark:divide-ink-700">
                  {allUsers
                    .filter((u) => !form.assignee_ids.includes(u.id))
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            assignee_ids: [...current.assignee_ids, u.id],
                          }))
                        }
                        className="flex w-full items-center justify-between gap-2 p-2.5 text-start transition-colors hover:bg-ink-50 dark:hover:bg-ink-800"
                      >
                        <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{u.full_name}</span>
                        <UserPlus className="size-3.5 shrink-0 text-ink-400" />
                      </button>
                    ))}
                  {allUsers.length === form.assignee_ids.length && (
                    <p className="p-3 text-center text-xs text-ink-400">{tCases("allAssigned")}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <ActionButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("saving")}
                </>
              ) : (
                tCases("form.saveCase")
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal title={tCases("deleteCase")} open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <div className="space-y-5">
          <p className="text-body-md text-ink-700 dark:text-ink-300">
            {tCases("deleteConfirm")}
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
              onClick={() => deleteCase(confirmDelete!)}
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

      <Modal title={tTrans("deleteTransaction")} open={!!confirmDeleteTransaction} onClose={() => setConfirmDeleteTransaction(null)}>
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
              onClick={() => setConfirmDeleteTransaction(null)}
              className="border border-ink-200 bg-white text-ink-800 rounded-md h-10 px-[18px] text-btn"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={deletingTransaction === confirmDeleteTransaction}
              onClick={() => deleteTransaction(confirmDeleteTransaction!)}
              className="bg-error-600 hover:bg-error-700 text-white rounded-md h-10 px-[18px] text-btn inline-flex items-center gap-2"
            >
              {deletingTransaction === confirmDeleteTransaction ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {tCommon("delete")}
            </button>
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
        <p className="text-caption-uppercase uppercase text-ink-600 dark:text-ink-300 sm:text-xs">
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

function OverviewTab({
  client,
  casesCount,
  cashFlowData,
  caseBreakdownData,
  userRole,
}: {
  client: ClientWithSummary;
  casesCount: number;
  cashFlowData: CashFlowPoint[];
  caseBreakdownData: CaseBreakdownPoint[];
  userRole: string | null;
}) {
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tCharts = useTranslations("Charts");
  const tClients = useTranslations("Clients");
  const locale = useLocale();

  const hasCashFlow = cashFlowData.some((d) => d.payments > 0 || d.expenses > 0);
  const hasCaseBreakdown = caseBreakdownData.length > 0;

  return (
    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Client overview card */}
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b border-ink-100 py-3 dark:border-ink-800 dark:bg-ink-950/20 sm:py-4">
          <CardTitle className="text-sm sm:text-base">{t("clientOverview")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-grow">
          <dl className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            {/* Row 1: Status & Cases No */}
            <div className="grid grid-cols-2">
              <div className="flex justify-between items-center px-4 py-4 sm:px-6 border-e border-ink-100 dark:border-ink-800">
                <dt className="text-ink-500 dark:text-ink-400">{tClients("form.status")}</dt>
                <dd>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border",
                      client.status === "active"
                        ? "bg-success-50 text-success-700 border-success-200/50 dark:bg-success-950/30 dark:text-success-400 dark:border-success-800/50"
                        : "bg-ink-50 text-ink-600 border-ink-200/50 dark:bg-ink-900 dark:text-ink-400 dark:border-ink-800/50"
                    )}
                  >
                    {client.status === "active" ? tClients("form.active") : tClients("form.inactive")}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{tCases("title")}</dt>
                <dd className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">{casesCount}</dd>
              </div>
            </div>

            {/* Row 2: Profit Type & Created Date */}
            <div className="grid grid-cols-2">
              <div className="flex justify-between items-center px-4 py-4 sm:px-6 border-e border-ink-100 dark:border-ink-800">
                <dt className="text-ink-500 dark:text-ink-400">{tClients("form.profitType")}</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100">
                  {client.profit_type === "monthly" ? tClients("form.monthly") : tClients("form.perCase")}
                </dd>
              </div>
              <div className="flex justify-between items-center px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{t("created")}</dt>
                <dd className="font-medium tabular-nums text-ink-800 dark:text-ink-100">
                  {formatDate(client.created_at, locale)}
                </dd>
              </div>
            </div>

            {/* Monthly Profit Row */}
            {userRole === "superadmin" && client.profit_type === "monthly" && (
              <div className="flex justify-between items-center px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{t("monthlyProfit") || "Monthly Profit"}</dt>
                <dd className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                  {formatCurrency(client.profit || 0, locale)}
                  {client.monthly_payment_day ? ` (يوم ${client.monthly_payment_day})` : ""}
                </dd>
              </div>
            )}

            {/* Row 4: Phone */}
            {client.phone && (
              <div className="flex justify-between px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{tClients("form.phone")}</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100 tabular-nums">
                  {client.phone}
                </dd>
              </div>
            )}

            {/* Row 5: Email */}
            {client.email && (
              <div className="flex justify-between px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{tClients("form.email")}</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100">
                  {client.email}
                </dd>
              </div>
            )}

            {/* Row 6: Created By */}
            {client.creator_name && (
              <div className="flex justify-between px-4 py-4 sm:px-6">
                <dt className="text-ink-500 dark:text-ink-400">{t("createdBy")}</dt>
                <dd className="font-medium text-ink-800 dark:text-ink-100">
                  {client.creator_name}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Cash flow chart */}
      {hasCashFlow && (
        <Card className="p-5 h-full flex flex-col justify-between">
          <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{tCharts("cashFlow")}</h3>
          <div className="flex-grow flex items-center justify-center">
            <CashFlowChart data={cashFlowData} locale={locale} />
          </div>
        </Card>
      )}

      {/* Case breakdown chart — superadmin only (has payment data) */}
      {hasCaseBreakdown && userRole === "superadmin" && (
        <Card className="p-5 md:col-span-2">
          <h3 className="mb-4 text-title-sm text-ink-800 dark:text-ink-100">{tCharts("clientBreakdown")}</h3>
          <ClientBreakdownChart data={caseBreakdownData} locale={locale} />
        </Card>
      )}
    </StaggerContainer>
  );
}

function CasesTab({ cases, userRole, client, currentUserId, onEdit, onDelete, deleting }: { cases: CaseWithSummary[], userRole: string | null, client: ClientWithSummary, currentUserId?: string, onEdit: (c: CaseWithSummary) => void, onDelete: (id: string) => void, deleting: string | null }) {
  const t = useTranslations("Cases");
  const tClients = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const showProfit = userRole === "superadmin" && client.profit_type === "per_case";

  function canModify(c: CaseWithSummary) {
    if (userRole === "superadmin") return true;
    return c.created_by === currentUserId;
  }

  return (
    <FadeInBox>
      <Card>
        <CardContent>
          <DataTable
            data={cases}
            empty={t("empty")}
            getRowKey={(c) => c.id}
            columns={[
              {
                key: "title",
                header: t("columns.title"),
                cell: (c) => (
                  <Link
                    href={`/clients/${encodeId(c.client_id)}/cases/${encodeId(c.id)}` as Route}
                    className="font-semibold text-ink-800 underline-offset-2 hover:text-accent-700 hover:underline dark:text-ink-50 dark:hover:text-accent-400"
                  >
                    {c.title}
                  </Link>
                ),
              },
              {
                key: "status",
                header: t("columns.status"),
                cell: (c) => (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", c.status === "open" ? "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400" : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-300")}>
                    {t(`status.${c.status}`)}
                  </span>
                ),
              },
              {
                key: "priority",
                header: t("form.priority"),
                cell: (c) => (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityBadgeClasses[c.priority])}>
                    {t(`priority.${c.priority}`)}
                  </span>
                ),
              },
              ...(showProfit ? [{
                key: "profit_amount",
                header: tClients("columns.profitDetails"),
                cell: (c: CaseWithSummary) => (
                  c.profit_amount ? (
                    <span className="font-semibold tabular-nums text-success-700 dark:text-success-400">
                      {formatCurrency(c.profit_amount, locale)}
                    </span>
                  ) : (
                    <span className="text-ink-400 dark:text-ink-500">—</span>
                  )
                ),
              }] : []),
              {
                key: "expenses",
                header: userRole === "superadmin" ? t("columns.expenses") : tCommon("myExpenses"),
                cell: (c: CaseWithSummary) => <span className="font-medium tabular-nums text-error-700 dark:text-error-400">{formatCurrency(c.total_expenses, locale)}</span>,
              },
              {
                key: "actions",
                header: "",
                className: "text-end",
                cell: (c: CaseWithSummary) => {
                  if (!canModify(c)) return null;
                  const isDeleting = deleting === c.id;
                  return (
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(c)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-ink-200 text-ink-500 hover:bg-ink-50 hover:text-accent-600 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-accent-400"
                        aria-label={tCommon("edit")}
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => onDelete(c.id)}
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
    </FadeInBox>
  );
}

function FilesTab({ clientId }: { clientId: string }) {
  const t = useTranslations("ClientDetails");
  const locale = useLocale();
  const [files, setFiles] = useState<(CaseFile & { cases: { title: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/clients/${clientId}/files`);
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) throw new Error(data.error || t("listError"));
          setFiles(data.files ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("listError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId, t]);

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleView(file: CaseFile) {
    window.open(`/api/cases/${file.case_id}/files/${file.id}/download`, "_blank");
  }

  function handleDownload(file: CaseFile) {
    window.open(`/api/cases/${file.case_id}/files/${file.id}/download?download=1`, "_blank");
  }

  return (
    <FadeInBox>
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-ink-400" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
              {error}
            </div>
          ) : files.length === 0 ? (
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
                      {file.cases?.title ?? ""} &middot; {formatFileSize(file.file_size)} &middot; {new Date(file.created_at).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })}
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeInBox>
  );
}

function FinanceTab({
  transactions,
  userRole,
  currentUserId,
  superadminIds,
  onDelete,
  deleting,
}: {
  transactions: TransactionWithUserAndCase[];
  userRole: string | null;
  currentUserId?: string;
  superadminIds?: Set<string>;
  onDelete?: (id: string) => void;
  deleting?: string | null;
}) {
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tTrans = useTranslations("Transaction");
  const tCommon = useTranslations("Common");
  const tClients = useTranslations("Clients");
  const locale = useLocale();

  function canModify(item: TransactionWithUserAndCase) {
    if (userRole === "superadmin") return true;
    if (userRole === "admin") {
      return item.type !== "profit" && !superadminIds?.has(item.created_by ?? "");
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
          empty={t("emptyLedger") || "No transactions found"}
          getRowKey={(t) => t.id}
          columns={[
            {
              key: "date",
              header: tTrans("columns.date"),
              cell: (item) => <span className="tabular-nums text-ink-500 dark:text-ink-400">{formatDate(item.date, locale)}</span>,
            },
            {
              key: "case",
              header: tCases("title") || "Case",
              cell: (item) => <span className="text-ink-500 dark:text-ink-400">{item.cases?.title || "-"}</span>,
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
                      item.type === "payment"
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
              cell: (item) => {
                const isProfit = item.type === "profit";
                const isPayment = item.type === "payment";
                const isPositive = isPayment || isProfit;
                return (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        isProfit
                          ? "text-blue-700 dark:text-blue-400"
                          : isPayment
                            ? "text-success-700 dark:text-success-400"
                            : "text-error-700 dark:text-error-400",
                      )}
                    >
                      {isPositive ? "+" : "-"}
                      {formatCurrency(item.amount, locale)}
                    </span>
                    {item.is_cleared && (
                      <span className="inline-flex rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                        {tClients("cleared") || "Cleared"}
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: "created_by",
              header: tTrans("columns.createdBy"),
              cell: (item: TransactionWithUserAndCase) => (
                <span className="text-ink-500 dark:text-ink-400">
                  {item.users?.full_name || "-"}
                </span>
              ),
            },
            ...(onDelete
              ? [
                  {
                    key: "actions",
                    header: "",
                    className: "text-end",
                    cell: (item: TransactionWithUserAndCase) => {
                      if (!canModify(item)) return null;
                      const isDeleting = deleting === item.id;
                      return (
                        <div className="flex justify-end gap-1">
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
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}
