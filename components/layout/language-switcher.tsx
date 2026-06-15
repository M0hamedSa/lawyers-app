"use client";

import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function toggleLocale() {
    const nextLocale = locale === "en" ? "ar" : "en";
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <button
      onClick={toggleLocale}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-nav-link text-ink-600 shadow-subtle transition-colors hover:bg-ink-50 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
    >
      <Globe className="size-4" aria-hidden />
      {locale === "en" ? "عربي" : "English"}
    </button>
  );
}
