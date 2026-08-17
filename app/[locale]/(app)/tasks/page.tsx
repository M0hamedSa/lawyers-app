import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getCurrentUser, getTasks, getAllUsers } from "@/lib/supabase/queries";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";
import type { CasePriority } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tTasks = await getTranslations({ locale, namespace: "Tasks" });
  return { title: tTasks("title") };
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string; user?: string }>;
}) {
  const { priority, user } = await searchParams;
  const currentUser = await getCurrentUser();
  const isManager = currentUser?.role === "admin" || currentUser?.role === "superadmin";

  const [tasks, allUsers] = await Promise.all([
    getTasks({
      priority: priority as CasePriority | undefined,
      userId: isManager ? user : undefined,
    }),
    isManager ? getAllUsers() : Promise.resolve([]),
  ]);

  const tTasks = await getTranslations("Tasks");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-caption-uppercase uppercase text-accent-700 dark:text-accent-400">
          {tTasks("title")}
        </p>
        <h1 className="mt-1 text-display-sm text-ink-800 dark:text-ink-100 sm:text-3xl">
          {tTasks("title")}
        </h1>
      </div>

      <TasksPageClient
        tasks={tasks}
        isManager={isManager}
        users={(allUsers ?? [])
          .filter((u) => u.status !== "closed")
          .map((u) => ({ id: u.id, full_name: u.full_name }))}
      />
    </div>
  );
}
