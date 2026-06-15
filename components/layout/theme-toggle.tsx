"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const THEME_STORAGE_KEY = "law-ledger-theme";

export function applyTheme(mode: "light" | "dark") {
  if (typeof document === "undefined") return;
  if (mode === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("Sidebar");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    const mode: "light" | "dark" = next ? "dark" : "light";
    applyTheme(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-nav-link text-ink-600 shadow-subtle transition-colors hover:bg-ink-50 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100",
        className,
      )}
      aria-pressed={dark}
      aria-label={dark ? t("useLightMode") : t("useDarkMode")}
    >
      <span className="flex items-center gap-2">
        {dark ? <Moon className="size-4 shrink-0" aria-hidden /> : <Sun className="size-4 shrink-0" aria-hidden />}
        {dark ? t("darkMode") : t("lightMode")}
      </span>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border border-ink-200 bg-ink-100 transition-colors dark:border-ink-600 dark:bg-ink-700",
          dark && "border-accent-500/50 bg-accent-500/20",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all duration-200 dark:bg-ink-200",
            dark ? "end-[2px] left-auto" : "start-[2px]",
          )}
        />
      </span>
    </button>
  );
}
