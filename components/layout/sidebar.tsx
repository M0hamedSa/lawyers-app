"use client";

import { ComponentType } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { BriefcaseBusiness, LayoutDashboard, Scale, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  translationKey: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", translationKey: "Dashboard.title", icon: LayoutDashboard },
  { href: "/clients", translationKey: "Clients.title", icon: BriefcaseBusiness },
  { href: "/admin/transactions", translationKey: "Admin.allTransactions", icon: History, adminOnly: true },
  { href: "/admin/users", translationKey: "Admin.manageUsers", icon: Users, adminOnly: true },
];

export function Sidebar({
  userRole,
}: {
  userRole: "superadmin" | "admin" | "user" | null;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tSidebar = useTranslations("Sidebar");
  const tDashboard = useTranslations("Dashboard");
  const tClients = useTranslations("Clients");
  const tAdmin = useTranslations("Admin");

  function getLabel(key: string) {
    if (key === "Dashboard.title") return tDashboard("title");
    if (key === "Clients.title") return tClients("title");
    if (key === "Admin.allTransactions") return tAdmin("allTransactions");
    if (key === "Admin.manageUsers") return tAdmin("manageUsers");
    return key;
  }

  return (
    /* RTL: sidebar on the right. LTR: on the left. */
    <aside
      className={cn(
        "relative flex w-full flex-col border-ink-100 bg-white/95 dark:border-ink-800 dark:bg-ink-900/95",
        "lg:fixed lg:inset-y-0 lg:z-50 lg:h-screen lg:min-h-0 lg:w-64 lg:border-e lg:shadow-xl shadow-ink-200/50 dark:shadow-black/40",
        isRtl ? "lg:right-0" : "lg:left-0"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Logo — h-14 matches navbar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ink-100 px-5 dark:border-ink-800">
        <div className="flex size-9 items-center justify-center rounded-md bg-ink-900 text-white dark:bg-brass-600">
          <Scale className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-700 dark:text-brass-400">
            {tSidebar("appName")}
          </p>
          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{tSidebar("subtitle")}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex gap-2 overflow-x-auto overflow-y-hidden px-3 py-2 [-webkit-overflow-scrolling:touch] lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-hidden lg:px-4 lg:py-5">
        <div className="flex min-w-0 gap-2 lg:flex-col lg:gap-1">
          {navItems
            .filter((item) => !item.adminOnly || userRole === "admin" || userRole === "superadmin")
            .map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-w-max items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition lg:min-w-0",
                    active
                      ? "bg-ink-900 text-white dark:bg-brass-600 dark:text-ink-900"
                      : "text-ink-700 hover:bg-ink-50 hover:text-ink-900 dark:text-ink-200 dark:hover:bg-ink-800 dark:hover:text-white",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{getLabel(item.translationKey)}</span>
                </Link>
              );
            })}
        </div>
      </nav>

    </aside>
  );
}
