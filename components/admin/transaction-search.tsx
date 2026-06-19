"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { useDebounce } from "use-debounce";
import { inputClassName } from "@/components/ui/field";

type ClientOption = { id: string; name: string };
type CaseOption = { id: string; title: string; client_id: string };

export function TransactionSearch({
  clients = [],
  cases = [],
}: {
  clients?: ClientOption[];
  cases?: CaseOption[];
}) {
  const t = useTranslations("Transaction");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [date, setDate] = useState(searchParams.get("date") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [clientId, setClientId] = useState(searchParams.get("client_id") || "");
  const [caseId, setCaseId] = useState(searchParams.get("case_id") || "");
  const [debouncedQuery] = useDebounce(query, 500);

  function handleClientChange(val: string) {
    setClientId(val);
    setCaseId("");
  }

  const availableCases = clientId ? cases.filter((c) => c.client_id === clientId) : [];
  const hasFilters = !!(query || date || type || clientId || caseId);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (date) params.set("date", date);
    if (type) params.set("type", type);
    if (clientId) params.set("client_id", clientId);
    if (caseId) params.set("case_id", caseId);

    const newSearch = params.toString();
    if (newSearch !== searchParams.toString()) {
      router.push(`${pathname}?${newSearch}` as Route);
    }
  }, [debouncedQuery, date, type, clientId, caseId, pathname, router, searchParams]);

  const clearFilters = () => {
    setQuery("");
    setDate("");
    setType("");
    setClientId("");
    setCaseId("");
    router.push(pathname as Route);
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {/* Search — full width on mobile */}
      <div className="relative col-span-2 min-w-0 sm:flex-1" style={{ minWidth: "160px" }}>
        <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-ink-400">
          <Search className="size-3.5" />
        </div>
        <input
          type="text"
          placeholder={t("search")}
          className={`${inputClassName} ps-9 text-sm`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Date */}
      <input
        type="date"
        className={`${inputClassName} w-full shrink-0 text-sm sm:w-36`}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title={t("filterByDate")}
      />

      {/* Type */}
      <select
        className={`${inputClassName} w-full shrink-0 appearance-none text-sm sm:w-36`}
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">{t("allTypes")}</option>
        <option value="payment">{tCommon("payment")}</option>
        <option value="expense">{tCommon("expense")}</option>
      </select>

      {/* Client */}
      {clients.length > 0 && (
        <select
          className={`${inputClassName} w-full shrink-0 appearance-none text-sm sm:w-40`}
          value={clientId}
          onChange={(e) => handleClientChange(e.target.value)}
        >
          <option value="">{t("allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {/* Case — only enabled after client is selected */}
      {clients.length > 0 && (
        <select
          className={`${inputClassName} w-full shrink-0 appearance-none text-sm transition-opacity sm:w-40 ${!clientId ? "cursor-not-allowed opacity-40" : ""}`}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          disabled={!clientId}
        >
          <option value="">{t("allCases")}</option>
          {availableCases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      )}

      {/* Clear — icon only */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          title={t("clearFilters")}
          className="col-span-2 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200 sm:col-span-1 sm:px-2"
        >
          <X className="size-4" />
          <span className="sm:hidden">{t("clearFilters")}</span>
        </button>
      )}
    </div>
  );
}
