import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { getCurrentUser, getUserFinancials, getAdminClients } from "@/lib/supabase/queries";
import { getLocale } from "next-intl/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, financials, locale, clients] = await Promise.all([
    getCurrentUser(),
    getUserFinancials(),
    getLocale(),
    getAdminClients(),
  ]);

  const isRtl = locale === "ar";

  return (
    <div className="min-h-screen bg-ink-50 text-ink-900 transition-colors dark:bg-[#121210] dark:text-ink-50">
      {/* Sidebar — fixed left (LTR) or fixed right (RTL) on desktop; horizontal scroll on mobile */}
      <Sidebar userRole={user?.role ?? null} />

      {/* Navbar — fixed top, offset from the sidebar side */}
      <Navbar
        userRole={user?.role ?? null}
        userName={user?.full_name ?? ""}
        financials={financials}
        clients={clients ?? []}
      />

      {/* Main — padded top for navbar (h-14), and side-padded for sidebar (w-64) */}
      <main
        className={
          isRtl
            ? "min-h-screen pt-14 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 lg:pr-72 lg:pl-8 lg:pb-6 lg:pt-[calc(3.5rem+1.5rem)]"
            : "min-h-screen pt-14 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 lg:pl-72 lg:pr-8 lg:pb-6 lg:pt-[calc(3.5rem+1.5rem)]"
        }
      >
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
