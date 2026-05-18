"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, FileText, Plus, Loader2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientWithSummary,
  LedgerTransaction,
  TransactionType,
  VoucherType,
} from "@/lib/supabase/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button";
import { 
  IncomeExpenseBarChart, 
  BalanceHistoryChart 
} from "@/components/charts/transaction-charts";

type Tab = "overview" | "finance" | "files";

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

export function ClientDetailsClient({
  client,
  initialTransactions,
  currentUser,
  userGlobalBalance,
}: {
  client: ClientWithSummary;
  initialTransactions: LedgerTransaction[];
  currentUser: { id: string; role: string; cash_advance: number } | null;
  userGlobalBalance?: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = useTranslations("ClientDetails");
  const tClients = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const tTrans = useTranslations("Transaction");
  const locale = useLocale();

  const userRole = currentUser?.role || null;
  const filteredInitialTransactions = (userRole === "superadmin" 
    ? initialTransactions 
    : initialTransactions.filter(t => t.created_by === currentUser?.id)
  ).filter(t => t.type === "expense");

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [transactions, setTransactions] = useState(filteredInitialTransactions);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TransactionForm>({
    ...emptyTransaction,
    type: "expense"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`client-ledger-${client.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `client_id=eq.${client.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const next = payload.new as LedgerTransaction;
            if (userRole !== "superadmin" && next.created_by !== currentUser?.id) return;
            if (next.type !== "expense") return;
            setTransactions((current) =>
              current.some((transaction) => transaction.id === next.id)
                ? current
                : [next, ...current],
            );
          }

          if (payload.eventType === "UPDATE") {
            const next = payload.new as LedgerTransaction;
            if (next.type !== "expense") {
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
  }, [client.id, router, supabase, userRole, currentUser?.id]);

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
  const profitToDeduct = userRole === "superadmin" ? Number(client.profit || 0) : 0;

  if (userRole === "superadmin") {
    displayPayments = totals.payments;
    if (profitToDeduct > 0) {
      displayPayments = Math.max(0, displayPayments - profitToDeduct);
    }
    balance = displayPayments - displayExpenses;
  } else {
    // For normal users: displayPayments is their cash advance,
    // balance is global (cash_advance - ALL expenses across all clients)
    displayPayments = currentUser?.cash_advance || 0;
    balance = userGlobalBalance !== undefined ? userGlobalBalance : displayPayments - displayExpenses;
  }

  async function saveTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

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
        type: form.type,
        amount,
        description: form.description.trim(),
        voucher_type: form.voucher_type,
        date: form.date,
        created_by: userId,
      })
      .select()
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <Link
            href="/clients"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-700 hover:text-brass-700 dark:text-ink-300 dark:hover:text-brass-400"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            {useTranslations("Clients")("title")}
          </Link>
          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
            {client.name}
          </h1>
          <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
            {client.phone || tCommon("noPhone")} · {client.email || tCommon("noEmail")}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <ExportTransactionsButton clientId={client.id} />
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {userRole !== "superadmin" && (
          <FinanceMetric label="Cash Advance" value={formatCurrency(displayPayments, locale)} tone="payment" />
        )}
        <FinanceMetric label={userRole === "superadmin" ? t("totalExpenses") : "My Expenses"} value={formatCurrency(displayExpenses, locale)} tone="expense" />
        {userRole === "superadmin" && (
          <FinanceMetric label={tClients("form.profit") || "Profit"} value={formatCurrency(Number(client.profit || 0), locale)} tone="payment" />
        )}
        <FinanceMetric label={t("currentBalance")} value={formatCurrency(balance, locale)} tone="balance" />
      </div>

      <div className="border-b border-ink-100 dark:border-ink-700">
        <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] sm:gap-2">
          {([
            ["overview", t("overview")],
            ["finance", t("finance")],
            ["files", t("files")],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition sm:px-4 sm:py-3",
                activeTab === tab
                  ? "border-brass-500 text-ink-900 dark:border-brass-400 dark:text-ink-50"
                  : "border-transparent text-ink-700 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <OverviewTab
          client={client}
          balance={balance}
          transactionCount={transactions.length}
          transactions={transactions}
          userRole={userRole}
        />
      ) : null}
      {activeTab === "finance" ? (
        <FinanceTab transactions={transactions} onAdd={() => setModalOpen(true)} />
      ) : null}
      {activeTab === "files" ? <FilesTab /> : null}

      <Modal title={t("addTransaction")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveTransaction} className="space-y-4">

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tCommon("amount")}>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                className={inputClassName}
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </Field>
            <Field label={tCommon("date")}>
              <input
                required
                type="date"
                className={inputClassName}
                value={form.date}
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              />
            </Field>
          </div>
          <Field label={tTrans("voucherType")}>
            <select
              className={inputClassName}
              value={form.voucher_type}
              onChange={(event) =>
                setForm((current) => ({ ...current, voucher_type: event.target.value as VoucherType }))
              }
            >
              {Object.entries(voucherLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {tTrans(`vouchers.${value}` as any) || label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tCommon("description")}>
            <textarea
              required
              className={textareaClassName}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <ActionButton
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => setModalOpen(false)}
            >
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton type="submit" className="w-full sm:w-auto" disabled={submitting}>
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

function FinanceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "payment" | "expense" | "balance";
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-ink-700 dark:text-ink-300">{label}</p>
        <p
          className={cn(
            "mt-2 break-words text-xl font-semibold tabular-nums sm:text-2xl",
            tone === "payment" && "text-green-700 dark:text-green-400",
            tone === "expense" && "text-red-700 dark:text-red-400",
            tone === "balance" && "text-ink-900 dark:text-ink-50",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  client,
  balance,
  transactionCount,
  transactions,
  userRole,
}: {
  client: ClientWithSummary;
  balance: number;
  transactionCount: number;
  transactions: LedgerTransaction[];
  userRole: string | null;
}) {
  const t = useTranslations("ClientDetails");
  const tClients = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("clientOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem label={tClients("form.name")} value={client.name} />
            <InfoItem label={tClients("form.phone")} value={client.phone || tCommon("noPhone")} />
            <InfoItem label={tClients("form.email")} value={client.email || tCommon("noEmail")} />
            <InfoItem label={t("transactions")} value={String(transactionCount)} />
          </dl>
          <div className="mt-6 border-t border-ink-100 pt-6">
            <dl className={cn("mb-6 grid gap-4", userRole === "superadmin" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
              <InfoItem label={t("balance")} value={formatCurrency(balance, locale)} />
              {userRole === "superadmin" && (
                <InfoItem label={tClients("form.profit") || "Profit"} value={formatCurrency(Number(client.profit || 0), locale)} />
              )}
              <InfoItem label={t("created")} value={formatDate(client.created_at, locale)} />
            </dl>
            <div className="mt-8 space-y-8 border-t border-ink-100 pt-8">
              <div className="rounded-xl border border-ink-100 bg-ink-50/30 p-4 dark:border-ink-800 dark:bg-ink-900/20">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  {useTranslations("Charts")("incomeExpense")}
                </h4>
                <IncomeExpenseBarChart transactions={transactions} showPayments={false} />
              </div>

              <div className="rounded-xl border border-ink-100 bg-ink-50/30 p-4 dark:border-ink-800 dark:bg-ink-900/20">
                <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                  {useTranslations("Charts")("balanceHistory")}
                </h4>
                <BalanceHistoryChart transactions={transactions} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-700 dark:text-ink-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-ink-900 dark:text-ink-100">{value}</dd>
    </div>
  );
}

function FinanceTab({
  transactions,
  onAdd,
}: {
  transactions: LedgerTransaction[];
  onAdd: () => void;
}) {
  const t = useTranslations("ClientDetails");
  const tTrans = useTranslations("Transaction");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const sortedTransactions = useMemo(() =>
    [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t("financialLedger")}</CardTitle>
        <ActionButton className="w-full shrink-0 sm:w-auto" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          {t("addTransaction")}
        </ActionButton>
      </CardHeader>
      <CardContent>
        <DataTable
          data={sortedTransactions}
          empty={t("emptyLedger")}
          getRowKey={(transaction) => transaction.id}
          columns={[
            {
              key: "date",
              header: tTrans("columns.date"),
              cell: (transaction) => formatDate(transaction.date, locale),
            },
            {
              key: "type",
              header: tTrans("columns.type"),
              cell: (transaction) => (
                <span
                  className={cn(
                    "inline-flex rounded-md px-2 py-1 text-xs font-semibold capitalize",
                    transaction.type === "payment"
                      ? "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-300"
                      : "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                  )}
                >
                  {tCommon(transaction.type)}
                </span>
              ),
            },
            {
              key: "description",
              header: tTrans("columns.description"),
              cell: (transaction) => (
                <span className="break-words text-ink-900 dark:text-ink-100">{transaction.description}</span>
              ),
            },
            {
              key: "voucher",
              header: tTrans("columns.voucher"),
              cell: (transaction) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const key = `vouchers.${transaction.voucher_type}` as any;
                return tTrans(key) || voucherLabels[transaction.voucher_type];
              },
            },
            {
              key: "amount",
              header: tTrans("columns.amount"),
              className: "text-end",
              cell: (transaction) => (
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    transaction.type === "payment"
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400",
                  )}
                >
                  {transaction.type === "payment" ? "+" : "-"}
                  {formatCurrency(Number(transaction.amount), locale)}
                </span>
              ),
            },
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
      <CardContent>
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-ink-700 dark:text-ink-300">
          <FileText className="size-8" aria-hidden />
          <p className="text-sm font-medium">{t("fileStorageText")}</p>
        </div>
      </CardContent>
    </Card>
  );
}
