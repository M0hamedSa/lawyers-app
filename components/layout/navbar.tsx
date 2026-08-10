"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { LogOut, Moon, Sun, Globe, ChevronDown, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { signOutAction } from "@/app/[locale]/(auth)/login/actions";
import { THEME_STORAGE_KEY, applyTheme } from "./theme-toggle";
import { ClientSelector } from "./client-selector";
import { NotificationsBell } from "./notifications-bell";
import type { AppNotification } from "@/lib/supabase/types";

export function Navbar({
  userId,
  userRole,
  userName,
  financials,
  clients = [],
  notifications = [],
  unreadNotificationCount = 0,
}: {
  userId: string | null;
  userRole: "superadmin" | "admin" | "user" | null;
  userName: string;
  financials: { cashAdvance: number; totalExpenses: number; balance: number } | null;
  clients?: { id: string; name: string }[];
  notifications?: AppNotification[];
  unreadNotificationCount?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tSidebar = useTranslations("Sidebar");
  const tRoles = useTranslations("Roles");
  const tCommon = useTranslations("Common");

  const [dark, setDark] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains("dark");
    const mode: "light" | "dark" = next ? "dark" : "light";
    applyTheme(mode);
    try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch { /* ignore */ }
    setDark(next);
  }

  function toggleLocale() {
    const nextLocale = locale === "en" ? "ar" : "en";
    router.replace(pathname, { locale: nextLocale });
  }

  async function handleLogout() {
    await signOutAction();
    router.push("/login");
  }

  const displayName = userName.trim() || tSidebar("unnamedUser");
  const initials = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-100 bg-white/95 backdrop-blur-sm px-4 dark:border-ink-800 dark:bg-ink-950/95",
        isRtl ? "lg:right-64" : "lg:left-64"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Client Selector (Quick Access) */}
      <ClientSelector clients={clients} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex flex-row-reverse items-center gap-1">

        {/* Notifications */}
        {userId && (
          <NotificationsBell
            userId={userId}
            initialNotifications={notifications}
            initialUnreadCount={unreadNotificationCount}
          />
        )}

        {/* User menu */}
        <div className="relative">

          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-nav-link transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/60"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-bold text-white dark:bg-accent-500">
              {initials}
            </span>
            <span className="hidden max-w-[120px] truncate text-nav-link text-ink-700 dark:text-ink-200 sm:block">
              {displayName}
            </span>
            <ChevronDown className={cn("size-3.5 text-ink-400 transition-transform duration-150", userMenuOpen && "rotate-180")} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className={cn(
                "absolute end-0 z-20 mt-2 w-64 rounded-xl border border-ink-100 bg-white p-3 shadow-dropdown dark:border-ink-800 dark:bg-ink-900",
                "animate-in fade-in slide-in-from-top-1 duration-150"
              )}>
                {/* User info */}
                <div className="mb-3 rounded-lg bg-ink-50 px-3.5 py-2.5 dark:bg-ink-800/60">
                  <p className="text-caption-uppercase uppercase tracking-wider text-ink-400">
                    {tSidebar("signedInAs")}
                  </p>
                  <p className="mt-0.5 truncate text-title-sm text-ink-800 dark:text-ink-100">{displayName}</p>
                  {userRole && (
                    <p className="text-body-sm text-ink-500 dark:text-ink-400">{tRoles(userRole)}</p>
                  )}
                </div>

                {/* My Financials */}
                {userRole !== "superadmin" && financials && (
                  <div className="mb-3 rounded-lg border border-accent-100 bg-accent-50/60 p-3.5 dark:border-accent-800/30 dark:bg-accent-950/20">
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <Wallet className="size-3.5 text-accent-600 dark:text-accent-400" />
                      <p className="text-caption-uppercase uppercase tracking-wider text-accent-700 dark:text-accent-400">
                        {tCommon("myFinancials")}
                      </p>
                    </div>
                    <div className="space-y-1.5 text-body-sm">
                      <div className="flex justify-between">
                        <span className="text-ink-600 dark:text-ink-400">{tCommon("myExpenses")}</span>
                        <span className="font-semibold text-error-500 dark:text-error-400">
                          {formatCurrency(financials.totalExpenses, locale)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-accent-100 pt-1.5 dark:border-accent-800/30">
                        <span className="font-medium text-ink-600 dark:text-ink-400">{tCommon("balance")}</span>
                        <span className="font-bold text-ink-800 dark:text-ink-100">
                          {formatCurrency(financials.balance, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Logout */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-error-100 bg-white px-3 py-2 text-btn font-semibold text-error-600 transition-colors hover:bg-error-50 dark:border-error-900/30 dark:bg-ink-900 dark:text-error-400 dark:hover:bg-error-950/30"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  {tSidebar("logout")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1.5 h-5 w-px bg-ink-200 dark:bg-ink-700" />

        {/* Language icon button */}
        <button
          type="button"
          onClick={toggleLocale}
          aria-label="Switch language"
          title={locale === "en" ? "عربي" : "English"}
          className="inline-flex size-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
        >
          <Globe className="size-4" />
        </button>

        {/* Dark mode icon button */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? tSidebar("useLightMode") : tSidebar("useDarkMode")}
          className="inline-flex size-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {/* Balance pill — non-superadmin only */}
        {userRole !== "superadmin" && financials && (
          <>
            <div className="hidden h-5 w-px bg-ink-200 dark:bg-ink-700 sm:block" />
            <div className="hidden items-center gap-1.5 rounded-lg border border-ink-100 bg-ink-50/80 px-3 py-1 dark:border-ink-800 dark:bg-ink-800/60 sm:flex">
              <Wallet className="size-3.5 shrink-0 text-accent-500 dark:text-accent-400" />
              <span className="text-body-sm font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                {formatCurrency(financials.balance, locale)}
              </span>
            </div>
          </>
        )}

      </div>
    </header>
  );
}
