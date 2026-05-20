"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";
import { LogOut, Moon, Sun, Globe, ChevronDown, Wallet } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { signOutAction } from "@/app/[locale]/(auth)/login/actions";
import { THEME_STORAGE_KEY, applyTheme } from "./theme-toggle";
import { ClientSelector } from "./client-selector";

export function Navbar({
  userRole,
  userName,
  financials,
  clients = [],
}: {
  userRole: "superadmin" | "admin" | "user" | null;
  userName: string;
  financials: { cashAdvance: number; totalExpenses: number; balance: number } | null;
  clients?: { id: string; name: string }[];
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
    /* RTL: sidebar is on the right → offset from the right. LTR: offset from the left. */
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-100 bg-white/95 px-4 backdrop-blur-sm dark:border-ink-800 dark:bg-ink-900/95",
        isRtl ? "lg:right-64" : "lg:left-64"
      )}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Client Selector (Quick Access) */}
      <ClientSelector clients={clients} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions — order: balance | dark mode | language | user avatar */}
      <div className="flex flex-row-reverse items-center gap-1">

        {/* User menu */}
        <div className="relative">

          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-ink-100 dark:hover:bg-ink-800"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-white dark:bg-brass-600 dark:text-ink-900">
              {initials}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink-900 dark:text-ink-50 sm:block">
              {displayName}
            </span>
            <ChevronDown className={cn("size-3.5 text-ink-400 transition-transform", userMenuOpen && "rotate-180")} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute end-0 z-20 mt-2 w-64 rounded-xl border border-ink-100 bg-white p-3 shadow-xl dark:border-ink-700 dark:bg-ink-900">
                {/* User info */}
                <div className="mb-3 rounded-lg bg-ink-50 px-3 py-2 dark:bg-ink-800/80">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                    {tSidebar("signedInAs")}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{displayName}</p>
                  {userRole && (
                    <p className="text-xs text-ink-500 dark:text-ink-400">{tRoles(userRole)}</p>
                  )}
                </div>

                {/* My Financials */}
                {userRole !== "superadmin" && financials && (
                  <div className="mb-3 rounded-lg border border-brass-200/60 bg-brass-50/50 p-3 dark:border-brass-700/40 dark:bg-brass-900/20">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Wallet className="size-3.5 text-brass-600 dark:text-brass-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brass-700 dark:text-brass-400">
                        {tCommon("myFinancials")}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink-600 dark:text-ink-400">{tCommon("cashAdvance")}</span>
                        <span className="font-semibold text-ink-900 dark:text-ink-50">
                          {formatCurrency(financials.cashAdvance, locale)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-600 dark:text-ink-400">{tCommon("myExpenses")}</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(financials.totalExpenses, locale)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-ink-200/70 pt-1 dark:border-ink-700">
                        <span className="font-medium text-ink-600 dark:text-ink-400">{tCommon("balance")}</span>
                        <span className="font-bold text-ink-900 dark:text-ink-50">
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 dark:border-red-900/50 dark:bg-ink-800 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  <LogOut className="size-4 shrink-0" aria-hidden />
                  {tSidebar("logout")}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-ink-200 dark:bg-ink-700" />

        {/* Language icon button */}
        <button
          type="button"
          onClick={toggleLocale}
          aria-label="Switch language"
          title={locale === "en" ? "عربي" : "English"}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
        >
          <Globe className="size-4" />
        </button>

        {/* Dark mode icon button */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={dark ? tSidebar("useLightMode") : tSidebar("useDarkMode")}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        {/* Balance pill — non-superadmin only */}
        {userRole !== "superadmin" && financials && (
          <>
            <div className="hidden h-6 w-px bg-ink-200 dark:bg-ink-700 sm:block" />
            <div className="hidden items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1 dark:border-ink-700 dark:bg-ink-800/60 sm:flex">
              <Wallet className="size-3.5 shrink-0 text-brass-600 dark:text-brass-400" />
              <span className="text-xs font-semibold tabular-nums text-ink-900 dark:text-ink-50">
                {formatCurrency(financials.balance, locale)}
              </span>
            </div>
          </>
        )}

      </div>
    </header>
  );
}
