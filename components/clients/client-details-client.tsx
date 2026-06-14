"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Edit2, FileText, Plus, Loader2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName, textareaClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type {
  ClientWithSummary,
  CaseWithSummary,
} from "@/lib/supabase/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";
import { ExportTransactionsButton } from "@/components/admin/export-transactions-button"; // Need to update this to client/cases export later

type Tab = "overview" | "cases" | "files";

type CaseForm = {
  id?: string;
  title: string;
  description: string;
  status: string;
  profit_amount: string;
};

const emptyCase: CaseForm = {
  title: "",
  description: "",
  status: "open",
  profit_amount: "",
};

export function ClientDetailsClient({
  client,
  initialCases,
  currentUser,
  userGlobalBalance,
}: {
  client: ClientWithSummary;
  initialCases: CaseWithSummary[];
  currentUser: { id: string; role: string; cash_advance: number } | null;
  userGlobalBalance?: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const userRole = currentUser?.role || null;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [cases, setCases] = useState(initialCases);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CaseForm>(emptyCase);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client.id, router, supabase]);

  // Sync state if server re-fetches
  useEffect(() => {
    setCases(initialCases);
  }, [initialCases]);

  const totals = cases.reduce(
    (acc, c) => {
      acc.payments += c.total_payments;
      acc.expenses += c.total_expenses;
      acc.profit += c.profit_amount ?? 0;
      return acc;
    },
    { payments: 0, expenses: 0, profit: 0 },
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
      profit_amount: client.profit_type === "per_case" ? (form.profit_amount ? Number(form.profit_amount) : 0) : 0,
    };

    let result;
    if (form.id) {
       result = await supabase.from("cases").update(payload).eq("id", form.id).select().single();
    } else {
       result = await supabase.from("cases").insert({ ...payload, created_by: userId }).select().single();
    }

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (form.id) {
      setCases((current) =>
        current.map((c) =>
          c.id === form.id ? { ...c, ...payload, updated_at: result.data.updated_at } : c
        )
      );
    } else {
      setCases((current) => [
        {
          ...result.data,
          total_payments: 0,
          total_expenses: 0,
          balance: 0,
        },
        ...current,
      ]);
    }

    setForm(emptyCase);
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
            <ArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
            {useTranslations("Clients")("title")}
          </Link>
          <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
            {client.name}
          </h1>
          <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">
            {client.phone || tCommon("noPhone")} · {client.email || tCommon("noEmail")}
          </p>
        </div>
        <div className="flex w-full shrink-0 flex-col-reverse gap-2 sm:w-auto sm:flex-row-reverse">
          <ExportTransactionsButton clientId={client.id} />
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
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {userRole === "superadmin" && (
          <FinanceMetric label={t("totalPayments") || "Total Payments"} value={formatCurrency(totals.payments, locale)} rawValue={totals.payments} tone="payment" />
        )}
        <FinanceMetric label={userRole === "superadmin" ? t("totalExpenses") : tCommon("myExpenses")} value={formatCurrency(displayExpenses, locale)} rawValue={displayExpenses} tone="expense" />
        <FinanceMetric label={t("currentBalance")} value={formatCurrency(balance, locale)} rawValue={balance} tone="balance" />
        {userRole === "superadmin" && client.profit_type === "monthly" && client.profit ? (
          <FinanceMetric 
            label={t("monthlyProfit") || "Monthly Profit"} 
            value={formatCurrency(client.profit, locale) + (client.monthly_payment_day ? ` (يوم ${client.monthly_payment_day})` : "")} 
            rawValue={client.profit} 
            tone="balance" 
          />
        ) : null}
        {userRole === "superadmin" && client.profit_type === "per_case" && totals.profit > 0 ? (
          <FinanceMetric
            label={t("totalProfit") || "Total Profit"}
            value={formatCurrency(totals.profit, locale)}
            rawValue={totals.profit}
            tone="payment"
          />
        ) : null}
      </div>

      <div className="border-b border-ink-100 dark:border-ink-700">
        <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] sm:gap-2">
          {([
            ["overview", t("overview")],
            ["cases", tCases("title")],
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
            casesCount={cases.length}
          />
      ) : null}
      {activeTab === "cases" ? (
        <CasesTab cases={cases} userRole={userRole} client={client} onEdit={(c) => {
          setForm({
            id: c.id,
            title: c.title,
            description: c.description || "",
            status: c.status,
            profit_amount: c.profit_amount ? String(c.profit_amount) : ""
          });
          setModalOpen(true);
        }} />
      ) : null}
      {activeTab === "files" ? <FilesTab /> : null}

      <Modal title={form.id ? tCases("editCase") : tCases("newCase")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveCase} className="space-y-4">
          <Field label={tCases("form.title")}>
            <input
              required
              className={inputClassName}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </Field>
          
          {client.profit_type === "per_case" && (
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
    </div>
  );
}

function FinanceMetric({ label, value, tone, rawValue }: { label: string; value: string; tone: "payment" | "expense" | "balance"; rawValue: number }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        <p className="text-[11px] font-medium uppercase tracking-wider text-ink-700 dark:text-ink-300 sm:text-xs">
          {label}
        </p>
        <p
          className={cn(
            "mt-1 sm:mt-2 truncate text-xl font-bold tabular-nums sm:text-2xl",
            tone === "payment" && "text-green-700 dark:text-green-400",
            tone === "expense" && "text-red-700 dark:text-red-400",
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

function OverviewTab({ client, balance, casesCount }: { client: ClientWithSummary; balance: number; casesCount: number }) {
  const t = useTranslations("ClientDetails");
  const tCases = useTranslations("Cases");
  const locale = useLocale();

  return (
    <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
      <Card>
        <CardHeader className="border-b border-ink-100 bg-ink-50/50 py-3 dark:border-ink-800 dark:bg-ink-950/20 sm:py-4">
          <CardTitle className="text-sm sm:text-base">{t("clientOverview")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <dl className="divide-y divide-ink-100 text-sm dark:divide-ink-800">
            <div className="flex justify-between px-4 py-3 sm:px-6">
              <dt className="text-ink-600 dark:text-ink-400">{tCases("title")}</dt>
              <dd className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">{casesCount}</dd>
            </div>
            <div className="flex justify-between px-4 py-3 sm:px-6">
              <dt className="text-ink-600 dark:text-ink-400">{t("balance")}</dt>
              <dd
                className={cn(
                  "text-xl font-bold tabular-nums sm:text-2xl",
                  "text-ink-900 dark:text-ink-50",
                )}
              >
                {formatCurrency(balance, locale)}
              </dd>
            </div>
            <div className="flex justify-between px-4 py-3 sm:px-6">
              <dt className="text-ink-600 dark:text-ink-400">{t("created")}</dt>
              <dd className="font-medium tabular-nums text-ink-900 dark:text-ink-50">
                {formatDate(client.created_at, locale)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function CasesTab({ cases, userRole, client, onEdit }: { cases: CaseWithSummary[], userRole: string | null, client: ClientWithSummary, onEdit: (c: CaseWithSummary) => void }) {
  const t = useTranslations("Cases");
  const tClients = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const showProfit = userRole === "superadmin" && client.profit_type === "per_case";

  return (
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
                  className="font-semibold text-ink-900 underline-offset-2 hover:text-brass-700 hover:underline dark:text-ink-50 dark:hover:text-brass-400"
                >
                  {c.title}
                </Link>
              ),
            },
            {
              key: "status",
              header: t("columns.status"),
              cell: (c) => (
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", c.status === "open" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-300")}>
                  {t(`status.${c.status}`)}
                </span>
              ),
            },
            ...(showProfit ? [{
              key: "profit_amount",
              header: tClients("columns.profitDetails"),
              cell: (c: CaseWithSummary) => (
                c.profit_amount ? (
                  <span className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                    {formatCurrency(c.profit_amount, locale)}
                  </span>
                ) : (
                  <span className="text-ink-400 dark:text-ink-500">—</span>
                )
              ),
            }] : []),
            ...(userRole === "superadmin" ? [
              {
                key: "payments",
                header: t("columns.payments"),
                cell: (c: CaseWithSummary) => <span className="font-medium tabular-nums text-green-700 dark:text-green-400">{formatCurrency(c.total_payments, locale)}</span>,
              },
            ] : []),
            {
              key: "expenses",
              header: userRole === "superadmin" ? t("columns.expenses") : tCommon("myExpenses"),
              cell: (c: CaseWithSummary) => <span className="font-medium tabular-nums text-red-700 dark:text-red-400">{formatCurrency(c.total_expenses, locale)}</span>,
            },
            ...(userRole === "superadmin" ? [
              {
                key: "balance",
                header: t("columns.balance"),
                cell: (c: CaseWithSummary) => (
                  <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                    {formatCurrency(c.balance, locale)}
                  </span>
                ),
              },
            ] : []),
            ...(userRole === "superadmin" || userRole === "admin" ? [
              {
                key: "actions",
                header: "",
                className: "text-end",
                cell: (c: CaseWithSummary) => (
                  <button
                    type="button"
                    onClick={() => onEdit(c)}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-ink-100 hover:bg-ink-50 dark:border-ink-600 dark:hover:bg-ink-800"
                    aria-label={tCommon("edit")}
                  >
                    <Edit2 className="size-4" aria-hidden />
                  </button>
                ),
              },
            ] : []),
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
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-brass-100 text-brass-700 dark:bg-brass-900/30 dark:text-brass-400">
          <FileText className="size-6" />
        </div>
        <p className="text-sm text-ink-600 dark:text-ink-400">{t("fileStorageText")}</p>
      </CardContent>
    </Card>
  );
}
