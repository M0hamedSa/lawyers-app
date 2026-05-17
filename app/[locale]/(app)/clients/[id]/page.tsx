import { notFound } from "next/navigation";
import { ClientDetailsClient } from "@/components/clients/client-details-client";
import { getClient, getClientTransactions, getCurrentUser, getUserFinancials } from "@/lib/supabase/queries";
import { decodeId } from "@/lib/id-utils";

export const dynamic = "force-dynamic";

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
