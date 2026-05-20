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

  // Extract active client ID from path if on client page
  const activeClientId = useMemo(() => {
    const match = pathname.match(/^\/clients\/([^/]+)/);
    return match ? decodeId(match[1]) : null;
  }, [pathname]);

  // Retrieve active client name
  const activeClientName = useMemo(() => {
    if (!activeClientId) return null;
    return clients.find((c) => c.id === activeClientId)?.name || null;
  }, [activeClientId, clients]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter((client) =>
      client.name.toLowerCase().includes(term)
    );
  }, [searchTerm, clients]);

  // Reset active index when filtered list changes or dropdown opens
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredClients, isOpen]);

  // Close dropdown on click outside
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

  // Autofocus input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({
          block: "nearest",
        });
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
      className="relative flex-1 max-w-[160px] sm:max-w-xs text-ink-900 dark:text-ink-50"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border px-3 text-xs transition-all duration-200",
          isOpen
            ? "border-brass-600 bg-white ring-1 ring-brass-600 dark:border-brass-500 dark:bg-ink-800"
            : "border-ink-200 bg-ink-50/50 hover:bg-ink-50 dark:border-ink-700/60 dark:bg-ink-800/40 dark:hover:bg-ink-800/80"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Briefcase className="size-3.5 shrink-0 text-ink-400 dark:text-ink-500" />
          <span className={cn("truncate font-medium", !activeClientName && "text-ink-500")}>
            {activeClientName
              ? activeClientName
              : tNavbar("searchClient")}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-ink-400 transition-transform duration-200",
            isOpen && "rotate-180 text-brass-600 dark:text-brass-400"
          )}
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full rounded-lg border border-ink-200 bg-white p-1.5 shadow-xl transition-all dark:border-ink-800 dark:bg-ink-900",
            "animate-in fade-in slide-in-from-top-1 duration-150"
          )}
        >
          {/* Search Box */}
          <div className="relative mb-1 flex items-center">
            <Search className="absolute start-2.5 size-3.5 text-ink-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={tNavbar("placeholder")}
              className={cn(
                "h-8 w-full rounded-md border border-ink-100 bg-ink-50 py-1.5 ps-8 pe-3 text-xs outline-none transition-colors",
                "focus:border-brass-500/50 focus:bg-white focus:ring-0 dark:border-ink-800 dark:bg-ink-950 dark:focus:bg-ink-950"
              )}
            />
          </div>

          {/* List of Clients */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto space-y-0.5 rounded-md"
          >
            {filteredClients.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-ink-400 dark:text-ink-500">
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
                      "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-start text-xs transition duration-150",
                      isActive
                        ? "bg-brass-50 text-brass-800 dark:bg-brass-950/40 dark:text-brass-300 font-semibold"
                        : isHighlighted
                        ? "bg-ink-50 text-ink-900 dark:bg-ink-800 dark:text-white"
                        : "text-ink-700 hover:bg-ink-50/50 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800/40 dark:hover:text-white"
                    )}
                  >
                    <span className="truncate">{client.name}</span>
                    {isActive && (
                      <Check className="size-3.5 shrink-0 text-brass-600 dark:text-brass-400" />
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
