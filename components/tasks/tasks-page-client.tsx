"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { inputClassName } from "@/components/ui/field";
import { cn, formatDate } from "@/lib/utils";
import { encodeId } from "@/lib/id-utils";
import type { CasePriority, Task } from "@/lib/supabase/types";

const priorityOrder: CasePriority[] = ["low", "medium", "high", "urgent"];

const priorityBadgeClasses: Record<CasePriority, string> = {
  low: "bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300",
  medium: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-error-50 text-error-700 dark:bg-error-900/30 dark:text-error-400",
};

export function TasksPageClient({
  tasks,
  isManager,
  users,
}: {
  tasks: Task[];
  isManager: boolean;
  users: { id: string; full_name: string }[];
}) {
  const t = useTranslations("Tasks");
  const tCases = useTranslations("Cases");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const priority = searchParams.get("priority") || "";
  const userFilter = searchParams.get("user") || "";

  function updateFilter(key: "priority" | "user", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    router.push((query ? `${pathname}?${query}` : pathname) as Route);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <select
            className={cn(inputClassName, "w-auto")}
            value={priority}
            onChange={(e) => updateFilter("priority", e.target.value)}
          >
            <option value="">{t("allPriorities")}</option>
            {priorityOrder.map((p) => (
              <option key={p} value={p}>
                {tCases(`priority.${p}`)}
              </option>
            ))}
          </select>

          {isManager && (
            <select
              className={cn(inputClassName, "w-auto")}
              value={userFilter}
              onChange={(e) => updateFilter("user", e.target.value)}
            >
              <option value="">{t("allUsers")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataTable
            data={tasks}
            empty={t("empty")}
            getRowKey={(task) => task.id}
            columns={[
              {
                key: "case",
                header: t("columns.case"),
                cell: (task) => (
                  <Link
                    href={`/clients/${encodeId(task.client_id)}/cases/${encodeId(task.case_id)}` as Route}
                    className="font-semibold text-ink-800 underline-offset-2 hover:text-accent-700 hover:underline dark:text-ink-50 dark:hover:text-accent-400"
                  >
                    {task.case_title}
                  </Link>
                ),
              },
              {
                key: "client",
                header: t("columns.client"),
                cell: (task) => <span className="text-ink-600 dark:text-ink-300">{task.client_name}</span>,
              },
              {
                key: "priority",
                header: t("columns.priority"),
                cell: (task) => (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", priorityBadgeClasses[task.priority])}>
                    {tCases(`priority.${task.priority}`)}
                  </span>
                ),
              },
              {
                key: "status",
                header: t("columns.status"),
                cell: (task) => (
                  <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", task.case_status === "open" ? "bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400" : "bg-ink-100 text-ink-800 dark:bg-ink-800 dark:text-ink-300")}>
                    {tCases(`status.${task.case_status}`)}
                  </span>
                ),
              },
              ...(isManager
                ? [
                    {
                      key: "assignedTo",
                      header: t("columns.assignedTo"),
                      cell: (task: Task) => <span className="text-ink-600 dark:text-ink-300">{task.user_name || "-"}</span>,
                    },
                    {
                      key: "assignedBy",
                      header: t("columns.assignedBy"),
                      cell: (task: Task) => <span className="text-ink-500 dark:text-ink-400">{task.assigned_by_name ?? "-"}</span>,
                    },
                  ]
                : []),
              {
                key: "assignedAt",
                header: t("columns.assignedAt"),
                cell: (task) => <span className="tabular-nums text-ink-500 dark:text-ink-400">{formatDate(task.created_at, locale)}</span>,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
