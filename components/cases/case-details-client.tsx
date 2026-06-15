"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, FileText, Plus, Loader2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientWithSummary,
  CaseWithSummary,
  LedgerTransaction,
  TransactionType,
  VoucherType,
} from "@/lib/supabase/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
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
  check: "Check",
  card: "Card",
  other: "Other",
};

export type TransactionWithUser = LedgerTransaction & { users?: { full_name: string } | null };

export function CaseDetailsClient({
  client,
  caseData,
  initialTransactions,
  currentUser,
  userGlobalBalance,
}: {
  client: ClientWithSummary;
  caseData: CaseWithSummary;
  initialTransactions: TransactionWithUser[];
  currentUser: { id: string; role: string; cash_advance: number; full_name?: string } | null;
  userGlobalBalance?: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tCommon = useTranslations("Common");
  const tTrans = useTranslations("Transaction");
  const locale = useLocale();

  const userRole = currentUser?.role || null;
  const filteredInitialTransactions = useMemo(
    () => userRole === "superadmin"
      ? initialTransactions
      : initialTransactions.filter(t => t.created_by === currentUser?.id && t.type === "expense"),
    [initialTransactions, userRole, currentUser?.id]
  );

  const [activeTab, setActiveTab] = useState<Tab>("finance");
  const [transactions, setTransactions] = useState<TransactionWithUser[]>(filteredInitialTransactions);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TransactionForm>({
    ...emptyTransaction,
    type: "expense"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseStatus] = useState(caseData.status);
  // Lock all transactions if the case is closed OR the client is inactive
  const isLocked = caseStatus === "closed" || client.status === "inactive";

  // Sync state if server re-fetches
  useEffect(() => {
    setTransactions(filteredInitialTransactions);
  }, [filteredInitialTransactions]);

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
            if (userRole !== "superadmin") {
              if (next.created_by !== currentUser?.id || next.type !== "expense") return;
            }
            // Attach current user's name so "Created By" column renders correctly
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
            if (userRole !== "superadmin" && next.type !== "expense") {
              setTransactions((current) => current.filter((t) => t.id !== next.id));
              return;
            }
            setTransactions((current) =>
              current.map((transaction) => (transaction.id === next.id ? next : transaction)),
            );
          }

          if (payload.eventType === "DELETE") {
            const previous = payload.old as Pick<LedgerTransaction, "id">;
            setTransactions((current) =>
              current.filter((transaction) => transaction.id !== previous.id),
            );
          }

          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseData.id, router, supabase, userRole, currentUser]);

  const totals = transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === "payment") acc.payments += Number(transaction.amount);
      if (transaction.type === "expense") acc.expenses += Number(transaction.amount);
      return acc;
    },
    { payments: 0, expenses: 0 },
  );

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

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    // Block if locked
    if (isLocked) {
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
    setForm({
      ...emptyTransaction,
      type: "expense"
    });
    setModalOpen(false);
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
            {caseData.description && <span className="text-ink-400">· {caseData.description}</span>}
          </p>
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

      <StaggerContainer className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userRole === "superadmin" && (
          <FinanceMetric label={t("totalPayments") || "Total Payments"} value={formatCurrency(totals.payments, locale)} rawValue={totals.payments} tone="payment" locale={locale} />
        )}
        <FinanceMetric label={userRole === "superadmin" ? t("totalExpenses") : tCommon("myExpenses")} value={formatCurrency(displayExpenses, locale)} rawValue={displayExpenses} tone="expense" locale={locale} />
        <FinanceMetric label={t("currentBalance")} value={formatCurrency(balance, locale)} rawValue={balance} tone="balance" locale={locale} />
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
        <FinanceTab transactions={transactions} userRole={userRole} />
        </FadeInBox>
      ) : null}
      {activeTab === "files" ? (
        <FadeInBox delay={0.2}>
        <FilesTab />
        </FadeInBox>
      ) : null}

      <Modal title={t("addTransaction")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveTransaction} className="space-y-4 [&_input]:w-full [&_select]:w-full">

          {userRole === "superadmin" && (
            <div className="space-y-1.5">
              <label className="text-title-sm text-ink-800 dark:text-ink-100">
                {tTrans("columns.type")}
              </label>
              <div className="grid grid-cols-2 gap-2">
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
              </div>
            </div>
          )}

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

          {form.type === "payment" && (
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
                tTrans("saveTransaction")
              )}
            </ActionButton>
          </div>
        </form>
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

function FinanceTab({ transactions, userRole }: { transactions: TransactionWithUser[]; userRole: string | null }) {
  const t = useTranslations("ClientDetails");
  const tTrans = useTranslations("Transaction");
  const locale = useLocale();

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
              cell: (item) => (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider sm:text-xs",
                    item.type === "payment"
                      ? "bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-400"
                      : "bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-400",
                  )}
                >
                  {item.type === "payment" ? tTrans("vouchers." + item.voucher_type) : tTrans("vouchers.other")}
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
                    item.type === "payment" ? "text-success-700 dark:text-success-400" : "text-error-700 dark:text-error-400",
                  )}
                >
                  {item.type === "expense" ? "-" : "+"}
                  {formatCurrency(item.amount, locale)}
                </span>
              ),
            },
            ...(userRole === "superadmin"
              ? [
                  {
                    key: "created_by",
                    header: tTrans("columns.createdBy"),
                    cell: (item: TransactionWithUser) => (
                      <span className="text-ink-500 dark:text-ink-400">
                        {item.users?.full_name || "-"}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}

function FilesTab() {
  const t = useTranslations("ClientDetails");

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400">
          <FileText className="size-6" />
        </div>
        <p className="text-sm text-ink-500 dark:text-ink-400">{t("fileStorageText")}</p>
      </CardContent>
    </Card>
  );
}
