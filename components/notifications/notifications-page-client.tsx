"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Bell, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatRelativeTime } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/supabase/types";
import { notificationHref, notificationMessage } from "@/lib/notifications";
import type { AppNotification } from "@/lib/supabase/types";

export function NotificationsPageClient({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: AppNotification[];
}) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const tCases = useTranslations("Cases");
  const locale = useLocale();
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialNotifications.length >= NOTIFICATIONS_PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-page-${userId}`)
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
          setNotifications((current) =>
            current.some((n) => n.id === next.id) ? current : [next, ...current],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  function messageFor(n: AppNotification) {
    return notificationMessage(n, locale, t, tCommon, (p) => tCases(`priority.${p}`));
  }

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllAsRead() {
    setNotifications((current) => current.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  }

  async function loadMore() {
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(notifications.length, notifications.length + NOTIFICATIONS_PAGE_SIZE - 1);

    if (!error && data) {
      setNotifications((current) => [...current, ...(data as AppNotification[])]);
      setHasMore(data.length >= NOTIFICATIONS_PAGE_SIZE);
    }
    setLoadingMore(false);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{t("title")}</CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-1">
        {notifications.length === 0 && (
          <p className="py-10 text-center text-body-sm text-ink-400">{t("empty")}</p>
        )}
        {notifications.map((n) => {
          const href = notificationHref(n);
          const content = (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-3 transition-colors",
                !n.is_read && "bg-accent-50/60 dark:bg-accent-950/20",
              )}
            >
              <Bell className="mt-0.5 size-4 shrink-0 text-accent-500" />
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-ink-700 dark:text-ink-200">{messageFor(n)}</p>
                <p className="mt-0.5 text-caption text-ink-400">
                  {formatRelativeTime(n.created_at, locale)}
                </p>
              </div>
              {!n.is_read && (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" aria-hidden />
              )}
            </div>
          );

          return (
            <div key={n.id} onClick={() => !n.is_read && markAsRead(n.id)}>
              {href ? (
                <Link href={href} className="block">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          );
        })}

        {hasMore && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-1.5 text-body-sm text-accent-600 transition-colors hover:text-accent-700 disabled:opacity-60 dark:text-accent-400 dark:hover:text-accent-300"
            >
              {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
              {t("loadMore")}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
