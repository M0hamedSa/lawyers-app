import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CaseDetailsClient } from "@/components/cases/case-details-client";
import { getClient, getCase, getCaseTransactions, getCurrentUser } from "@/lib/supabase/queries";
import { decodeId } from "@/lib/id-utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string, caseId: string, locale: string }> }): Promise<Metadata> {
  const { caseId: hash, locale } = await params;
  const id = decodeId(hash);
  const t = await getTranslations({ locale, namespace: "Cases" });
  
  try {
    const caseData = await getCase(id);
    return { title: `${t("title")} - ${caseData.title}` };
  } catch {
    return { title: t("title") };
  }
}

export default async function CaseDetailsPage({ params }: { params: Promise<{ id: string, caseId: string }> }) {
  const { id: clientHash, caseId: caseHash } = await params;
  const clientId = decodeId(clientHash);
  const caseId = decodeId(caseHash);

  try {
    const [client, caseData, transactions, currentUser] = await Promise.all([
      getClient(clientId),
      getCase(caseId),
      getCaseTransactions(caseId),
      getCurrentUser(),
    ]);

    if (caseData.client_id !== clientId) {
      notFound();
    }

    let userGlobalBalance: number | undefined = undefined;
    if (currentUser?.role !== "superadmin") {
      const { getUserFinancials } = await import("@/lib/supabase/queries");
      const financials = await getUserFinancials();
      userGlobalBalance = financials?.balance;
    }

    return <CaseDetailsClient 
      client={client} 
      caseData={caseData}
      initialTransactions={transactions} 
      currentUser={currentUser}
      userGlobalBalance={userGlobalBalance}
    />;
  } catch {
    notFound();
  }
}
