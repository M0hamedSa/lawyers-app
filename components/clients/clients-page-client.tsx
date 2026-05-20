"use client";

import { useEffect, useMemo, useState } from "react";
import type { Route } from "next";
import { Link, useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { Edit2, Plus, Trash2, Loader2 } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Field, inputClassName } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import type { ClientWithSummary } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";

type ClientForm = {
  id?: string;
  name: string;
  phone: string;
  email: string;
  profit: string;
};

const emptyForm: ClientForm = { name: "", phone: "", email: "", profit: "" };

export function ClientsPageClient({ 
  initialClients, 
  userRole 
}: { 
  initialClients: ClientWithSummary[];
  userRole: "superadmin" | "admin" | "user" | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const locale = useLocale();
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const tDashboard = useTranslations("Dashboard");
  const [clients, setClients] = useState(initialClients);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("clients-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  async function saveClient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      profit: form.profit ? Number(form.profit) : 0,
    };

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    const userId = userResult.user?.id;

    if (authError || !userId) {
      setError(tCommon("sessionError") || "User session not found. Please log in again.");
      setSubmitting(false);
      return;
    }

    const result = form.id
      ? await supabase.from("clients").update(payload).eq("id", form.id).select().single()
      : await supabase
          .from("clients")
          .insert({ ...payload, created_by: userId })
          .select()
          .single();

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setModalOpen(false);
    setForm(emptyForm);
    router.refresh();

    if (form.id) {
      setClients((current) =>
        current.map((client) =>
          client.id === form.id ? { ...client, ...payload, updated_at: result.data.updated_at } : client,
        ),
      );
    } else {
      setClients((current) => [
        {
          ...result.data,
          total_payments: 0,
          total_expenses: 0,
          balance: 0,
        },
        ...current,
      ]);
    }
  }

  function openDeleteConfirm(id: string) {
    setDeletingId(id);
    setIsDeleteModalOpen(true);
  }

  async function deleteClient() {
    if (!deletingId) return;
    setSubmitting(true);

    const { error: deleteError } = await supabase.from("clients").delete().eq("id", deletingId);
    setSubmitting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setClients((current) => current.filter((client) => client.id !== deletingId));
    setIsDeleteModalOpen(false);
    setDeletingId(null);
    router.refresh();
  }

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(client: ClientWithSummary) {
    setForm({
      id: client.id,
      name: client.name,
      phone: client.phone ?? "",
      email: client.email ?? "",
      profit: client.profit != null ? String(client.profit) : "",
    });
    setError(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-700 dark:text-brass-400">
            {t("title")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50 sm:text-3xl">
            {t("heading")}
          </h1>
        </div>
        {(userRole === "admin" || userRole === "superadmin") && (
          <ActionButton className="w-full shrink-0 sm:w-auto" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("newClient")}
          </ActionButton>
        )}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <Card>
        <CardContent>
          <DataTable
            data={clients}
            empty={t("empty")}
            getRowKey={(client) => client.id}
            columns={[
              {
                key: "name",
                header: t("columns.client"),
                cell: (client) => (
                  <Link
                    href={`/clients/${encodeId(client.id)}` as Route}
                    className="font-semibold text-ink-900 underline-offset-2 hover:text-brass-700 hover:underline dark:text-ink-50 dark:hover:text-brass-400"
                  >
                    {client.name}
                  </Link>
                ),
              },
              {
                key: "contact",
                header: t("columns.contact"),
                cell: (client) => (
                  <div className="space-y-1 text-ink-700 dark:text-ink-300">
                    <p>{client.phone || tCommon("noPhone")}</p>
                    <p>{client.email || tCommon("noEmail")}</p>
                  </div>
                ),
              },
              ...(userRole === "superadmin"
                ? [
                    {
                      key: "total_payments",
                      header: tDashboard("totalPayments"),
                      cell: (client: ClientWithSummary) => (
                        <span className="font-medium tabular-nums text-green-700 dark:text-green-400">
                          {formatCurrency(client.total_payments, locale)}
                        </span>
                      ),
                    },
                    {
                      key: "payments",
                      header: t("columns.payments"),
                      cell: (client: ClientWithSummary) => {
                        const profitToDeduct = Number(client.profit || 0);
                        const adjustedPayments = Math.max(0, client.total_payments - profitToDeduct);
                        return (
                          <span className="font-medium tabular-nums text-green-700 dark:text-green-400">
                            {formatCurrency(adjustedPayments, locale)}
                          </span>
                        );
                      },
                    },
                    {
                      key: "expenses",
                      header: t("columns.expenses"),
                      cell: (client: ClientWithSummary) => (
                        <span className="font-medium tabular-nums text-red-700 dark:text-red-400">
                          {formatCurrency(client.total_expenses, locale)}
                        </span>
                      ),
                    },
                    {
                      key: "balance",
                      header: t("columns.balance"),
                      cell: (client: ClientWithSummary) => {
                        const profitToDeduct = Number(client.profit || 0);
                        const adjustedBalance = client.balance - profitToDeduct;
                        return (
                          <span className="font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                            {formatCurrency(adjustedBalance, locale)}
                          </span>
                        );
                      },
                    },
                    {
                      key: "profit",
                      header: t("form.profit") || "Profit",
                      cell: (client: ClientWithSummary) => (
                        <span className="font-medium tabular-nums text-brass-700 dark:text-brass-400">
                          {formatCurrency(Number(client.profit || 0), locale)}
                        </span>
                      ),
                    },
                  ]
                : [
                    {
                      key: "expenses",
                      header: tCommon("myExpenses"),
                      cell: (client: ClientWithSummary) => (
                        <span className="font-medium tabular-nums text-red-700 dark:text-red-400">
                          {formatCurrency(client.total_expenses, locale)}
                        </span>
                      ),
                    }
                  ].filter(Boolean) as {
                    key: string;
                    header: string;
                    cell: (row: ClientWithSummary) => React.ReactNode;
                    className?: string;
                  }[]),
              {
                key: "actions",
                header: "",
                className: "text-end",
                cell: (client) => (
                  <div className="flex flex-wrap justify-end gap-2 sm:justify-end">
                    {(userRole === "admin" || userRole === "superadmin") && (
                      <button
                        type="button"
                        onClick={() => openEdit(client)}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-ink-100 hover:bg-ink-50 dark:border-ink-600 dark:hover:bg-ink-800"
                        aria-label={tCommon("edit")}
                      >
                        <Edit2 className="size-4" aria-hidden />
                      </button>
                    )}
                    {(userRole === "admin" || userRole === "superadmin") && (
                      <button
                        type="button"
                        onClick={() => openDeleteConfirm(client.id)}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                        aria-label={tCommon("delete")}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Modal title={form.id ? t("editClient") : t("newClient")} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form onSubmit={saveClient} className="space-y-4">
          <Field label={t("form.name")}>
            <input
              required
              className={inputClassName}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.phone")}>
              <input
                className={inputClassName}
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </Field>
            <Field label={t("form.email")}>
              <input
                type="email"
                className={inputClassName}
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </Field>
          </div>
          {userRole === "superadmin" && (
            <Field label={t("form.profit") || "Profit Amount"}>
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClassName}
                value={form.profit}
                onChange={(event) => setForm((current) => ({ ...current, profit: event.target.value }))}
                placeholder="0.00"
              />
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
                t("form.saveClient")
              )}
            </ActionButton>
          </div>
        </form>
      </Modal>

      <Modal title={t("deleteClient") || "Delete Client"} open={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)}>
        <div className="space-y-6">
          <p className="text-ink-700 dark:text-ink-300">
            {t("deleteConfirm") || "Are you sure you want to delete this client? This action cannot be undone and will delete all associated transactions."}
          </p>
          <div className="flex justify-end gap-3">
            <ActionButton variant="secondary" onClick={() => setIsDeleteModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
            <ActionButton 
              onClick={deleteClient} 
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tCommon("deleting") || "Deleting..."}
                </>
              ) : (
                tCommon("delete") || "Delete"
              )}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
