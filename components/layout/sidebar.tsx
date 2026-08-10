"use client";

import { ComponentType, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { BriefcaseBusiness, LayoutDashboard, History, Users, Building2, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  translationKey: string;
  icon: ComponentType<{ className?: string }>;
  superadminOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", translationKey: "Dashboard.title", icon: LayoutDashboard },
  { href: "/clients", translationKey: "Clients.title", icon: BriefcaseBusiness },
  { href: "/tasks", translationKey: "Tasks.title", icon: ListTodo },
  { href: "/admin/transactions", translationKey: "Admin.allTransactions", icon: History, superadminOnly: true },
  { href: "/admin/users",        translationKey: "Admin.manageUsers",    icon: Users,           superadminOnly: true },
  { href: "/admin/cash-advance", translationKey: "Admin.cashAdvances",   icon: BriefcaseBusiness, superadminOnly: true },
  { href: "/admin/office",       translationKey: "Admin.officeTransactions", icon: Building2,     superadminOnly: true },
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
  const tTasks = useTranslations("Tasks");

  useEffect(() => {
    const links = document.querySelectorAll("[data-nav-item]");
    if (links.length > 0) {
      gsap.fromTo(
        links,
        { x: isRtl ? 12 : -12, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out", delay: 0.1 }
      );
    }
  }, [isRtl]);

  function getLabel(key: string) {
    if (key === "Dashboard.title") return tDashboard("title");
    if (key === "Clients.title") return tClients("title");
    if (key === "Tasks.title") return tTasks("title");
    if (key === "Admin.allTransactions") return tAdmin("allTransactions");
    if (key === "Admin.manageUsers") return tAdmin("manageUsers");
    if (key === "Admin.cashAdvances") return tAdmin("cashAdvances");
    if (key === "Admin.officeTransactions") return tAdmin("officeTransactions");
    return key;
  }

  return (
    <aside
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 flex h-16 border-t border-ink-100 bg-white/95 backdrop-blur-sm dark:border-ink-800 dark:bg-ink-950/95",
        "lg:top-0 lg:bottom-auto lg:h-screen lg:w-64 lg:flex-col lg:border-t-0 lg:border-e lg:border-ink-100 lg:dark:border-ink-800 lg:bg-white lg:dark:bg-ink-950",
        isRtl ? "lg:right-0 lg:left-auto" : "lg:left-0 lg:right-auto"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Logo area — hidden on mobile, refined on desktop */}
      <div className="hidden h-24 shrink-0 items-center gap-3 border-b border-ink-100 px-5 dark:border-ink-800 lg:flex">
        <div className="flex size-11 items-center justify-center shrink-0">
          <Image src="/logo.png" alt="Logo" width={44} height={44} className="w-full h-full rounded-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="text-body-sm font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">
            {tSidebar("appName")}
          </p>
          <p className="truncate text-body-sm text-ink-500 dark:text-ink-400">{tSidebar("subtitle")}</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 flex items-center gap-0.5 w-full overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] lg:flex-col lg:justify-start lg:gap-0.5 lg:overflow-y-auto lg:overflow-x-visible lg:px-3 lg:py-6">
        {navItems
          .filter((item) => {
            if (item.superadminOnly && userRole !== "superadmin") return false;
            return true;
          })
          .map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                data-nav-item
                href={item.href}
                className={cn(
                  "relative flex shrink-0 flex-col items-center justify-center gap-0.5 py-1.5 px-3 text-[11px] font-medium transition-colors w-auto min-w-[64px] max-w-[84px]",
                  "lg:flex-row lg:justify-start lg:gap-3 lg:py-3 lg:px-3.5 lg:text-[15px] lg:max-w-none lg:w-full lg:min-w-0 lg:shrink lg:rounded-md",
                  active
                    ? "text-accent-600 dark:text-accent-400 lg:text-accent-700 lg:bg-accent-50 lg:dark:text-accent-300 lg:dark:bg-accent-950/30"
                    : "text-ink-400 hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-200 lg:text-ink-500 lg:hover:text-ink-700 lg:hover:bg-ink-50 lg:dark:text-ink-400 lg:dark:hover:text-ink-100 lg:dark:hover:bg-ink-900/60",
                )}
              >
                {active && (
                  <span
                    className={cn(
                      "absolute hidden lg:block top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-accent-500 dark:bg-accent-400",
                      isRtl ? "right-0" : "left-0",
                    )}
                    aria-hidden
                  />
                )}
                <Icon className={cn("size-5 shrink-0", active && "lg:text-accent-600 dark:lg:text-accent-400")} aria-hidden />
                <span className="truncate max-w-[68px] lg:max-w-none">{getLabel(item.translationKey)}</span>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
