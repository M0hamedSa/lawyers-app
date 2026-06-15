"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, Briefcase } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { encodeId, decodeId } from "@/lib/id-utils";

type SimpleClient = {
  id: string;
  name: string;
};

export function ClientSelector({ clients = [] }: { clients?: SimpleClient[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tNavbar = useTranslations("Navbar");

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeClientId = useMemo(() => {
    const match = pathname.match(/^\/clients\/([^/]+)/);
    return match ? decodeId(match[1]) : null;
  }, [pathname]);

  const activeClientName = useMemo(() => {
    if (!activeClientId) return null;
    return clients.find((c) => c.id === activeClientId)?.name || null;
  }, [activeClientId, clients]);

  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter((client) =>
      client.name.toLowerCase().includes(term)
    );
  }, [searchTerm, clients]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredClients, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleSelect = (clientId: string) => {
    setIsOpen(false);
    setSearchTerm("");
    router.push(`/clients/${encodeId(clientId)}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredClients.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : filteredClients.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredClients.length) {
          handleSelect(filteredClients[activeIndex].id);
        } else if (filteredClients.length > 0) {
          handleSelect(filteredClients[0].id);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 max-w-[160px] sm:max-w-xs text-ink-800 dark:text-ink-100"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-body-sm transition-all duration-150",
          isOpen
            ? "border-accent-500 bg-white ring-1 ring-accent-500/20 shadow-subtle dark:border-accent-500 dark:bg-ink-900"
            : "border-ink-200 bg-ink-50/80 hover:bg-ink-50 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-800/60 dark:hover:bg-ink-800 dark:hover:border-ink-600"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Briefcase className="size-3.5 shrink-0 text-ink-400 dark:text-ink-500" />
          <span className={cn("truncate font-medium", !activeClientName && "text-ink-400")}>
            {activeClientName
              ? activeClientName
              : tNavbar("searchClient")}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-400 transition-transform duration-200",
            isOpen && "rotate-180 text-accent-600 dark:text-accent-400"
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1.5 w-full rounded-xl border border-ink-200 bg-white p-2 shadow-dropdown dark:border-ink-800 dark:bg-ink-900",
            "animate-in fade-in slide-in-from-top-1 duration-150"
          )}
        >
          <div className="relative mb-1.5 flex items-center">
            <Search className="absolute start-3 size-3.5 text-ink-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tNavbar("placeholder")}
              className={cn(
                "h-8 w-full rounded-lg border border-ink-100 bg-ink-50 py-1.5 ps-9 pe-3 text-body-sm outline-none transition-colors",
                "focus:border-accent-500/50 focus:bg-white focus:ring-1 focus:ring-accent-500/20 dark:border-ink-800 dark:bg-ink-950 dark:focus:bg-ink-900"
              )}
            />
          </div>

          <div
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto space-y-0.5 rounded-lg"
          >
            {filteredClients.length === 0 ? (
              <div className="px-3 py-6 text-center text-body-sm text-ink-400 dark:text-ink-500">
                {tNavbar("noClientsFound")}
              </div>
            ) : (
              filteredClients.map((client, index) => {
                const isActive = client.id === activeClientId;
                const isHighlighted = index === activeIndex;

                return (
                  <button
                    key={client.id}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(client.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-start text-body-sm transition-colors duration-100",
                      isActive
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 font-semibold"
                        : isHighlighted
                        ? "bg-ink-50 text-ink-800 dark:bg-ink-800 dark:text-ink-100"
                        : "text-ink-600 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100"
                    )}
                  >
                    <span className="truncate">{client.name}</span>
                    {isActive && (
                      <Check className="size-3.5 shrink-0 text-accent-600 dark:text-accent-400" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
