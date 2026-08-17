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
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "");
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "");
  const [type, setType] = useState(searchParams.get("type") || "");
  const [clientId, setClientId] = useState(searchParams.get("client_id") || "");
  const [caseId, setCaseId] = useState(searchParams.get("case_id") || "");
  const [caseStatus, setCaseStatus] = useState(searchParams.get("case_status") || "");
  const [debouncedQuery] = useDebounce(query, 500);

  function handleClientChange(val: string) {
    setClientId(val);
    setCaseId("");
  }

  const availableCases = clientId ? cases.filter((c) => c.client_id === clientId) : [];
  const hasFilters = !!(query || dateFrom || dateTo || type || clientId || caseId || caseStatus);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("query", debouncedQuery);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (type) params.set("type", type);
    if (clientId) params.set("client_id", clientId);
    if (caseId) params.set("case_id", caseId);
    if (caseStatus) params.set("case_status", caseStatus);

    const newSearch = params.toString();
    if (newSearch !== searchParams.toString()) {
      router.push(`${pathname}?${newSearch}` as Route);
    }
  }, [debouncedQuery, dateFrom, dateTo, type, clientId, caseId, caseStatus, pathname, router, searchParams]);

  const clearFilters = () => {
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setType("");
    setClientId("");
    setCaseId("");
    setCaseStatus("");
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

      {/* Date From */}
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <label htmlFor="dateFrom" className="whitespace-nowrap text-sm text-ink-600 dark:text-ink-300">
          {t("fromDate")}
        </label>
        <input
          id="dateFrom"
          type="date"
          className={`${inputClassName} flex-1 text-sm sm:w-36 sm:flex-none`}
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </div>

      {/* Date To */}
      <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
        <label htmlFor="dateTo" className="whitespace-nowrap text-sm text-ink-600 dark:text-ink-300">
          {t("toDate")}
        </label>
        <input
          id="dateTo"
          type="date"
          className={`${inputClassName} flex-1 text-sm sm:w-36 sm:flex-none`}
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      {/* Type */}
      <select
        className={`${inputClassName} w-full shrink-0 appearance-none text-sm sm:w-36`}
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="">{t("allTypes")}</option>
        <option value="payment">{tCommon("payment")}</option>
        <option value="expense">{tCommon("expense")}</option>
        <option value="office">{tCommon("office")}</option>
        <option value="profit">{t("profit") || "Profit"}</option>
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

      {/* Case Status */}
      <select
        className={`${inputClassName} w-full shrink-0 appearance-none text-sm sm:w-36`}
        value={caseStatus}
        onChange={(e) => setCaseStatus(e.target.value)}
      >
        <option value="">{t("allCaseStatuses") || "All Cases"}</option>
        <option value="open">{t("openCases") || "Open"}</option>
        <option value="closed">{t("closedCases") || "Closed"}</option>
      </select>

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
