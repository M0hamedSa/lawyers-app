"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton } from "@/components/ui/action-button";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { UserPlus, Users, Mail, Loader2 } from "lucide-react";
import { Field, inputClassName } from "@/components/ui/field";

type UserWithAccess = {
  id: string;
  full_name: string;
  role: UserRole;
  cash_advance: number;
  client_access: { client_id: string }[];
};

type ClientMinimal = {
  id: string;
  name: string;
};

export function UsersManagement({
  initialUsers,
  allClients,
  currentRole,
  currentUserId
}: {
  initialUsers: UserWithAccess[];
  allClients: ClientMinimal[];
  currentRole: "superadmin" | "admin" | "user" | null;
  currentUserId: string;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("UserManagement");
  const tLogin = useTranslations("Login");
  const tRoles = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<UserWithAccess[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserWithAccess | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", role: "user" });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [cashAdvanceInput, setCashAdvanceInput] = useState<string>("");

  function openManage(user: UserWithAccess) {
    setSelectedUser(user);
    setCashAdvanceInput(user.cash_advance?.toString() || "0");
    setModalOpen(true);
  }

  async function changeRole(newRole: UserRole) {
    if (!selectedUser || currentRole !== "superadmin") return;

    setSubmitting(true);
    setTogglingId(`role-${newRole}`);
    const { error } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", selectedUser.id);

    if (!error) {
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, role: newRole } : u
      ));
      setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
    }
    setSubmitting(false);
    setTogglingId(null);
  }

  async function updateCashAdvance() {
    if (!selectedUser || currentRole !== "superadmin") return;

    const newAmount = parseFloat(cashAdvanceInput) || 0;
    setSubmitting(true);
    setTogglingId("cash-advance");
    const { error } = await supabase
      .from("users")
      .update({ cash_advance: newAmount })
      .eq("id", selectedUser.id);

    if (!error) {
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id ? { ...u, cash_advance: newAmount } : u
      ));
      setSelectedUser(prev => prev ? { ...prev, cash_advance: newAmount } : null);
    }
    setSubmitting(false);
    setTogglingId(null);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setInviteError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const appBase =
        (process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
          (typeof window !== "undefined" ? window.location.origin : "")) || "";
      const redirectTo = appBase ? `${appBase}/${locale}/set-password` : undefined;

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ...inviteForm, redirectTo }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to invite user");
      }

      setInviteModalOpen(false);
      setInviteForm({ email: "", full_name: "", role: "user" });
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setInviteError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAccess(clientId: string, hasAccess: boolean) {
    if (!selectedUser) return;

    setSubmitting(true);
    setTogglingId(clientId);
    if (hasAccess) {
      // Remove access
      const { error } = await supabase
        .from("client_access")
        .delete()
        .eq("user_id", selectedUser.id)
        .eq("client_id", clientId);

      if (!error) {
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id
            ? { ...u, client_access: u.client_access.filter(a => a.client_id !== clientId) }
            : u
        ));
        setSelectedUser(prev => prev ? {
          ...prev,
          client_access: prev.client_access.filter(a => a.client_id !== clientId)
        } : null);
      }
    } else {
      // Grant access
      const { error } = await supabase
        .from("client_access")
        .insert({ user_id: selectedUser.id, client_id: clientId });

      if (!error) {
        setUsers(prev => prev.map(u =>
          u.id === selectedUser.id
            ? { ...u, client_access: [...u.client_access, { client_id: clientId }] }
            : u
        ));
        setSelectedUser(prev => prev ? {
          ...prev,
          client_access: [...prev.client_access, { client_id: clientId }]
        } : null);
      }
    }
    setSubmitting(false);
    setTogglingId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-stretch sm:justify-end">
        {currentRole === "superadmin" && (
          <ActionButton className="w-full sm:w-auto" onClick={() => setInviteModalOpen(true)}>
            <UserPlus className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
            {t("invite")}
          </ActionButton>
        )}
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
                header: t("fullName"),
                cell: (u) => (
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-ink-100 text-ink-600">
                      <Users className="size-4" />
                    </div>
                    <span className="font-medium text-ink-800 dark:text-ink-100">{u.full_name}</span>
                  </div>
                ),
              },
              {
                key: "role",
                header: t("role"),
                cell: (u) => (
                  <span className="inline-flex rounded-md bg-ink-100 px-2 py-1 text-xs font-semibold text-ink-600">
                    {tRoles(u.role)}
                  </span>
                ),
              },
              {
                key: "clients",
                header: t("assignedClients"),
                cell: (u) => (
                  <span className="text-sm text-ink-600 dark:text-ink-300">
                    {u.client_access.length}
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "text-end",
                cell: (u) => (
                  <ActionButton variant="secondary" onClick={() => openManage(u)}>
                    {t("manageAccess")}
                  </ActionButton>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Modal
        title={t("manageAccess")}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-ink-100 pb-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{selectedUser?.full_name}</p>
              <p className="text-xs text-ink-400">{selectedUser?.role}</p>
            </div>
          </div>

          {currentRole === "superadmin" && (
            <>
              <div className="space-y-2 border-b border-ink-100 pb-4">
                <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">{t("userRole")}</label>
                {selectedUser?.id === currentUserId && selectedUser?.role === "superadmin" ? (
                  <p className="text-xs text-accent-700 font-medium">
                    {t("lockoutWarning")}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(["user", "admin", "superadmin"] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={submitting}
                        onClick={() => changeRole(r)}
                        className={cn(
                          "flex min-w-[calc(50%-0.25rem)] flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition sm:min-w-0",
                          selectedUser?.role === r
                            ? "border-ink-900 bg-ink-800 text-white dark:border-accent-400 dark:bg-accent-500 dark:text-ink-800"
                            : "border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800"
                        )}
                      >
                        {togglingId === `role-${r}` && <Loader2 className="size-3 animate-spin" />}
                        {tRoles(r)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2 border-b border-ink-100 pb-4">
                <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">{tCommon("cashAdvance")} ({locale === "ar" ? "ج.م." : "EGP"})</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClassName}
                    value={cashAdvanceInput}
                    onChange={(e) => setCashAdvanceInput(e.target.value)}
                  />
                  <ActionButton 
                    disabled={submitting} 
                    onClick={updateCashAdvance}
                  >
                    {togglingId === 'cash-advance' ? <Loader2 className="size-4 animate-spin" /> : tCommon("save")}
                  </ActionButton>
                </div>
              </div>
            </>
          )}

          <div className="space-y-4">
            <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">{t("clientAccess")}</label>
            <p className="text-sm text-ink-600 dark:text-ink-300">
              {t("clientAccessDesc")}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-ink-100 dark:border-ink-700">
              <div className="divide-y divide-ink-50 dark:divide-ink-700">
                {allClients.map((client) => {
                  const hasAccess = selectedUser?.client_access.some(a => a.client_id === client.id);
                  return (
                    <div key={client.id} className="flex items-center justify-between p-3 hover:bg-ink-50 dark:hover:bg-ink-800">
                      <span className="text-sm font-medium text-ink-800 dark:text-ink-100">{client.name}</span>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => toggleAccess(client.id, !!hasAccess)}
                        className={cn(
                          "flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold transition",
                          hasAccess
                            ? "bg-error-50 text-error-700 hover:bg-error-100 dark:bg-error-900/20 dark:text-error-400"
                            : "bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-900/20 dark:text-success-400"
                        )}
                      >
                        {togglingId === client.id && <Loader2 className="size-3 animate-spin" />}
                        {hasAccess ? t("revoke") : t("grant")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <ActionButton onClick={() => setModalOpen(false)}>
              {t("done")}
            </ActionButton>
          </div>
        </div>
      </Modal>

      <Modal
        title={t("invite")}
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      >
        <form onSubmit={handleInvite} className="space-y-4 [&_input]:w-full [&_select]:w-full">
          <p className="text-sm text-ink-600 dark:text-ink-300">
            {t("inviteDesc")}
          </p>

          {inviteError && (
            <div className="rounded-md bg-error-50 p-3 text-sm text-error-700 dark:bg-error-900/20 dark:text-error-400">
              {inviteError}
            </div>
          )}

        <Field label={t("fullName")} className="dark:text-ink-50">
          <input
            required
            className={inputClassName}
            value={inviteForm.full_name}
            onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
            placeholder="e.g. John Doe"
          />
        </Field>

        <Field label={tLogin("email")} className="dark:text-ink-50">
          <input
            required
            type="email"
            className={inputClassName}
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            placeholder="john@example.com"
          />
        </Field>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">{t("initialRole")}</label>
          <div className="flex gap-2">
            {(["user", "admin", "superadmin"] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setInviteForm({ ...inviteForm, role: r })}
                className={cn(
                  "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition",
                  inviteForm.role === r
                    ? "border-ink-900 bg-ink-800 text-white"
                    : "border-ink-200 text-ink-600 hover:bg-ink-50"
                )}
              >
                {tRoles(r)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <ActionButton
            variant="secondary"
            type="button"
            onClick={() => setInviteModalOpen(false)}
          >
            {t("cancel")}
          </ActionButton>
          <ActionButton type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-2 rtl:mr-0 rtl:ml-2 animate-spin" />
                {t("sending")}
              </>
            ) : (
              <>
                <Mail className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
                {t("sendInvite")}
              </>
            )}
          </ActionButton>
        </div>
      </form>
    </Modal>
    </div >
  );
}
