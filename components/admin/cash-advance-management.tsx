"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ActionButton } from "@/components/ui/action-button";
import { Modal } from "@/components/ui/modal";
import { useLocale, useTranslations } from "next-intl";
import { Users, Loader2, Download } from "lucide-react";
import { inputClassName } from "@/components/ui/field";
import { CountUpNumber } from "@/components/ui/animated";

type UserFinancials = {
  id: string;
  full_name: string;
  role: string;
  cash_advance: number;
  total_expenses: number;
  balance: number;
};

export function CashAdvanceManagement({
  initialUsers,
}: {
  initialUsers: UserFinancials[];
}) {
  const locale = useLocale();
  const t = useTranslations("CashAdvance");
  const tRoles = useTranslations("Roles");
  const tCommon = useTranslations("Common");
  const supabase = useMemo(() => createClient(), []);
  
  const [users, setUsers] = useState<UserFinancials[]>(initialUsers);
  const [selectedUser, setSelectedUser] = useState<UserFinancials | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cashAdvanceInput, setCashAdvanceInput] = useState<string>("");

  function openEdit(user: UserFinancials) {
    setSelectedUser(user);
    setCashAdvanceInput(user.cash_advance?.toString() || "0");
    setModalOpen(true);
  }

  async function updateCashAdvance() {
    if (!selectedUser) return;

    const newAmount = parseFloat(cashAdvanceInput) || 0;
    setSubmitting(true);
    
    const { error } = await supabase
      .from("users")
      .update({ cash_advance: newAmount })
      .eq("id", selectedUser.id);

    if (!error) {
      setUsers(prev => prev.map(u =>
        u.id === selectedUser.id 
          ? { ...u, cash_advance: newAmount, balance: newAmount - u.total_expenses } 
          : u
      ));
      setModalOpen(false);
    }
    setSubmitting(false);
  }

  const handleExport = () => {
    window.location.href = `/api/export-cash-advance?locale=${locale}`;
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

      <div className="flex justify-between items-center">
        <h3 className="text-display-sm text-ink-800 dark:text-ink-100">{t("teamMembers")}</h3>
        <ActionButton onClick={handleExport} variant="secondary">
          <Download className="size-4 mr-2 rtl:mr-0 rtl:ml-2" />
          {t("reportTitle")}
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
                key: "cash_advance",
                header: t("currentAdvance"),
                cell: (u) => (
                  <span className="font-medium text-accent-700 dark:text-accent-400">
                    <CountUpNumber value={u.cash_advance} />
                  </span>
                ),
              },
              {
                key: "total_expenses",
                header: t("totalExpenses"),
                cell: (u) => (
                  <span className="text-error-600 dark:text-error-400">
                    <CountUpNumber value={u.total_expenses} />
                  </span>
                ),
              },
              {
                key: "balance",
                header: t("currentBalance"),
                cell: (u) => (
                  <span className="font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                    <CountUpNumber value={u.balance} />
                  </span>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "text-end",
                cell: (u) => (
                  <ActionButton variant="secondary" onClick={() => openEdit(u)}>
                    {t("editAdvance")}
                  </ActionButton>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      <Modal
        title={t("updateAdvance")}
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
              <p className="text-xs text-ink-400">{selectedUser?.role && tRoles(selectedUser.role)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-ink-800 dark:text-ink-100">
              {t("newAmount")} ({locale === "ar" ? "ج.م." : "EGP"})
            </label>
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
                {submitting ? <Loader2 className="size-4 animate-spin" /> : tCommon("save")}
              </ActionButton>
            </div>
          </div>
          
          <div className="flex justify-end pt-2">
            <ActionButton variant="secondary" onClick={() => setModalOpen(false)}>
              {tCommon("cancel")}
            </ActionButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
