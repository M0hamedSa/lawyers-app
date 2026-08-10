"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Bell, Check, Trash2, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { notificationHref, notificationMessage } from "@/lib/notifications";
import type { AppNotification } from "@/lib/supabase/types";

export function NotificationsBell({
  userId,
  initialNotifications,
  initialUnreadCount,
}: {
  userId: string;
  initialNotifications: AppNotification[];
  initialUnreadCount: number;
}) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const tCases = useTranslations("Cases");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);

  const refreshUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false)
      .is("cleared_at", null);
    setUnreadCount(count ?? 0);
  }, [supabase, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as AppNotification;
          setNotifications((current) => [next, ...current].slice(0, 30));
          setUnreadCount((count) => count + 1);
          setToasts((current) => [...current, next]);
          setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== next.id));
          }, 6000);
          new Audio("/sound/notification.mp3").play().catch(() => {});
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as AppNotification;
          setNotifications((current) => current.map((n) => (n.id === next.id ? next : n)));
          void refreshUnreadCount();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, refreshUnreadCount]);

  function messageFor(n: AppNotification) {
    return notificationMessage(n, locale, t, tCommon, (p) => tCases(`priority.${p}`));
  }

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((count) => {
      const target = notifications.find((n) => n.id === id);
      return target && !target.is_read ? Math.max(0, count - 1) : count;
    });
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllAsRead() {
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }

  async function clearAll() {
    setNotifications([]);
    setUnreadCount(0);
    await supabase
      .from("notifications")
      .update({ is_read: true, cleared_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("cleared_at", null);
  }

  function dismissToast(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("title")}
          className="relative inline-flex size-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800/60 dark:hover:text-ink-200"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className={cn(
              "absolute -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-bold leading-none text-white",
              isRtl ? "-left-0.5" : "-right-0.5",
            )}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              className={cn(
                "absolute z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-ink-100 bg-white p-3 shadow-dropdown dark:border-ink-800 dark:bg-ink-900",
                "animate-in fade-in slide-in-from-top-1 duration-150",
                isRtl ? "left-0" : "right-0",
              )}
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-title-sm text-ink-800 dark:text-ink-100">{t("title")}</p>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 text-body-sm text-accent-600 transition-colors hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
                    >
                      <Check className="size-3.5" />
                      {t("markAllRead")}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      aria-label={t("clearAll")}
                      title={t("clearAll")}
                      className="flex items-center gap-1 text-body-sm text-ink-400 transition-colors hover:text-error-600 dark:text-ink-500 dark:hover:text-error-400"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-96 space-y-1 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="py-6 text-center text-body-sm text-ink-400">{t("empty")}</p>
                )}
                {notifications.map((n) => {
                  const href = notificationHref(n);
                  const content = (
                    <div
                      className={cn(
                        "rounded-lg px-2.5 py-2 transition-colors",
                        !n.is_read && "bg-accent-50/60 dark:bg-accent-950/20",
                      )}
                    >
                      <p className="text-body-sm text-ink-700 dark:text-ink-200">{messageFor(n)}</p>
                      <p className="mt-0.5 text-caption text-ink-400">
                        {formatRelativeTime(n.created_at, locale)}
                      </p>
                    </div>
                  );

                  return (
                    <div key={n.id} onClick={() => !n.is_read && markAsRead(n.id)}>
                      {href ? (
                        <Link href={href} onClick={() => setOpen(false)} className="block">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </div>
                  );
                })}
              </div>

              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="mt-2 block rounded-lg py-1.5 text-center text-body-sm text-accent-600 transition-colors hover:bg-ink-50 hover:text-accent-700 dark:text-accent-400 dark:hover:bg-ink-800/60 dark:hover:text-accent-300"
              >
                {t("viewAll")}
              </Link>
            </div>
          </>
        )}
      </div>

      <div
        className={cn(
          "fixed top-16 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2",
          isRtl ? "left-4" : "right-4",
        )}
      >
        {toasts.map((n) => {
          const href = notificationHref(n);
          const body = (
            <div className="flex items-start gap-2 rounded-xl border border-ink-100 bg-white p-3 shadow-dropdown dark:border-ink-800 dark:bg-ink-900 animate-in fade-in slide-in-from-top-2 duration-200">
              <Bell className="mt-0.5 size-4 shrink-0 text-accent-500" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-ink-700 dark:text-ink-200">{messageFor(n)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dismissToast(n.id);
                }}
                className="shrink-0 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );

          return (
            <div key={n.id} onClick={() => markAsRead(n.id)}>
              {href ? (
                <Link href={href} onClick={() => dismissToast(n.id)}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
