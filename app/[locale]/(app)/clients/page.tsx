import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientsPageClient } from "@/components/clients/clients-page-client";
import { getClients, getUserRole } from "@/lib/supabase/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Clients");
  return { title: t("title") };
}

export default async function ClientsPage() {
  const [clients, role] = await Promise.all([getClients(), getUserRole()]);
  return <ClientsPageClient initialClients={clients} userRole={role} />;
}
