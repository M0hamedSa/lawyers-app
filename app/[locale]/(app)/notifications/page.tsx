import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { getCurrentUser, getAllNotifications } from "@/lib/supabase/queries";
import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tNotifications = await getTranslations({ locale, namespace: "Notifications" });
  return { title: tNotifications("title") };
}

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect({ href: "/dashboard", locale: locale as "en" | "ar" });
  }

  const notifications = await getAllNotifications();
  const tNotifications = await getTranslations("Notifications");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-caption-uppercase uppercase text-accent-700 dark:text-accent-400">
          {tNotifications("title")}
        </p>
        <h1 className="mt-1 text-display-sm text-ink-800 dark:text-ink-100 sm:text-3xl">
          {tNotifications("title")}
        </h1>
      </div>

      <NotificationsPageClient userId={currentUser!.id} initialNotifications={notifications} />
    </div>
  );
}
