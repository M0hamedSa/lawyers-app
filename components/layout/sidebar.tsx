"use client";

import { ComponentType } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { BriefcaseBusiness, LayoutDashboard, History, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  translationKey: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  superadminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", translationKey: "Dashboard.title", icon: LayoutDashboard },
  { href: "/clients", translationKey: "Clients.title", icon: BriefcaseBusiness },
  { href: "/admin/transactions", translationKey: "Admin.allTransactions", icon: History, adminOnly: true },
  { href: "/admin/users", translationKey: "Admin.manageUsers", icon: Users, adminOnly: true },
  { href: "/admin/cash-advance", translationKey: "Admin.cashAdvances", icon: BriefcaseBusiness, adminOnly: true, superadminOnly: true },
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
    if (key === "Admin.cashAdvances") return tAdmin("cashAdvances");
    return key;
  }

  return (
    /* Responsive layout: fixed bottom bar on mobile, fixed side sidebar on desktop */
    <aside
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 flex h-16 border-t border-ink-100 bg-white/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:border-ink-800 dark:bg-ink-900/95 dark:shadow-[0_-2px_10px_rgba(0,0,0,0.2)]",
        "lg:top-0 lg:bottom-auto lg:h-screen lg:w-64 lg:flex-col lg:border-t-0 lg:border-e lg:shadow-xl lg:shadow-ink-200/50 lg:dark:shadow-black/40",
        isRtl ? "lg:right-0 lg:left-auto" : "lg:left-0 lg:right-auto"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Logo — hidden on mobile, visible on desktop */}
      <div className="hidden h-14 shrink-0 items-center gap-3 border-b border-ink-100 px-5 dark:border-ink-800 lg:flex">
        <div className="flex size-9 items-center justify-center shrink-0">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-brass-700 dark:text-brass-400">
            {tSidebar("appName")}
          </p>
          <p className="truncate text-xs text-ink-500 dark:text-ink-400">{tSidebar("subtitle")}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex items-center justify-around w-full lg:flex-col lg:justify-start lg:gap-1 lg:overflow-y-auto lg:px-4 lg:py-5">
        {navItems
          .filter((item) => {
            if (item.superadminOnly && userRole !== "superadmin") return false;
            if (item.adminOnly && userRole !== "admin" && userRole !== "superadmin") return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-1 px-3 text-[9px] font-medium transition-colors w-full max-w-[80px]",
                  "lg:flex-row lg:justify-start lg:gap-3 lg:py-2 lg:px-3 lg:text-sm lg:max-w-none lg:w-full lg:rounded-md",
                  active
                    ? "text-brass-700 dark:text-brass-400 lg:bg-ink-900 lg:text-white lg:dark:bg-brass-600 lg:dark:text-ink-900"
                    : "text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-white lg:text-ink-700 lg:hover:bg-ink-50 lg:hover:text-ink-900 lg:dark:text-ink-200 lg:dark:hover:bg-ink-800 lg:dark:hover:text-white",
                )}
              >
                <Icon className={cn("size-5 shrink-0 lg:size-4", active && "text-brass-700 dark:text-brass-400 lg:text-current")} aria-hidden />
                <span className="truncate max-w-[64px] lg:max-w-none">{getLabel(item.translationKey)}</span>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
