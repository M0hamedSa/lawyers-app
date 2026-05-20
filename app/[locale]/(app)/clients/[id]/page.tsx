import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientDetailsClient } from "@/components/clients/client-details-client";
import { getClient, getClientTransactions, getCurrentUser, getUserFinancials } from "@/lib/supabase/queries";
import { decodeId } from "@/lib/id-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string, locale: string }> }): Promise<Metadata> {
  const { id: hash, locale } = await params;
  const id = decodeId(hash);
  const t = await getTranslations({ locale, namespace: "Clients" });
  
  try {
    const client = await getClient(id);
    return { title: `${t("title")} - ${client.name}` };
  } catch {
    return { title: t("title") };
  }
}
export default async function ClientDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: hash } = await params;
  const id = decodeId(hash);

  try {
    const [client, transactions, currentUser, userFinancials] = await Promise.all([
      getClient(id),
      getClientTransactions(id),
      getCurrentUser(),
      getUserFinancials(),
    ]);

    return <ClientDetailsClient 
      client={client} 
      initialTransactions={transactions} 
      currentUser={currentUser}
      userGlobalBalance={userFinancials?.balance}
    />;
  } catch {
    notFound();
  }
}
