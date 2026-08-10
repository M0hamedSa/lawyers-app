import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser, getUserFinancials, getAdminClients, getNotifications } from "@/lib/supabase/queries";
import { getLocale } from "next-intl/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, financials, locale, clients, { notifications, unreadCount }] = await Promise.all([
    getCurrentUser(),
    getUserFinancials(),
    getLocale(),
    getAdminClients(),
    getNotifications(),
  ]);

  const isRtl = locale === "ar";

  return (
    <div className="h-screen overflow-hidden bg-ink-50 text-ink-800 transition-colors dark:bg-ink-950 dark:text-ink-100">
      <Sidebar userRole={user?.role ?? null} />
      <Navbar
        userId={user?.id ?? null}
        userRole={user?.role ?? null}
        userName={user?.full_name ?? ""}
        financials={financials}
        clients={clients ?? []}
        notifications={notifications}
        unreadNotificationCount={unreadCount}
      />
      <main
        className={
          isRtl
            ? "h-full overflow-y-auto pt-20 px-4 pb-28 sm:px-6 lg:pr-72 lg:pl-8 lg:pb-8 lg:pt-[4.5rem]"
            : "h-full overflow-y-auto pt-20 px-4 pb-28 sm:px-6 lg:pl-72 lg:pr-8 lg:pb-8 lg:pt-[4.5rem]"
        }
      >
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
