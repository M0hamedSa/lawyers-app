import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClientDetailsClient } from "@/components/clients/client-details-client";
import { getClient, getCases, getCurrentUser, getUserFinancials, getClientTransactions } from "@/lib/supabase/queries";
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
    const [client, cases, currentUser, userFinancials, transactions] = await Promise.all([
      getClient(id),
      getCases(id),
      getCurrentUser(),
      getUserFinancials(),
      getClientTransactions(id),
    ]);

    // Build cash flow chart data (last 6 months)
    const now = new Date();
    const months: { key: string; payments: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        payments: 0,
        expenses: 0,
      });
    }
    for (const tx of transactions) {
      const month = (tx.date as string | undefined)?.slice(0, 7);
      const entry = months.find((m) => m.key === month);
      if (!entry) continue;
      if (tx.type === "payment") entry.payments += Number(tx.amount);
      if (tx.type === "expense") entry.expenses += Number(tx.amount);
    }
    const cashFlowData = months.map((m) => ({ month: m.key, payments: m.payments, expenses: m.expenses }));

    // Build case breakdown chart data (payments vs expenses per case)
    const caseBreakdownData = cases
      .filter((c) => c.total_payments > 0 || c.total_expenses > 0)
      .map((c) => ({ name: c.title, payments: c.total_payments, expenses: c.total_expenses }));

    return (
      <ClientDetailsClient
        client={client}
        initialCases={cases}
        currentUser={currentUser}
        userGlobalBalance={userFinancials?.balance}
        cashFlowData={cashFlowData}
        caseBreakdownData={caseBreakdownData}
      />
    );
  } catch {
    notFound();
  }
}
