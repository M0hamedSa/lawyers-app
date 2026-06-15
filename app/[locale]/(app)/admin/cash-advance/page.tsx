import type { Metadata } from "next";
import { getAllUsers, getCurrentUser } from "@/lib/supabase/queries";
import { CashAdvanceManagement } from "@/components/admin/cash-advance-management";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const tCashAdvance = await getTranslations({ locale, namespace: "CashAdvance" });
  return { title: tCashAdvance("title") };
}
export default async function AdminCashAdvancePage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  const currentUser = await getCurrentUser();
  const role = currentUser?.role;
  
  if (role !== "superadmin") {
    redirect({ href: "/dashboard", locale: locale as "en" | "ar" });
  }

  const users = await getAllUsers();
  
  // Fetch all expenses to calculate totals
  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, created_by")
    .eq("type", "expense");

  // Aggregate expenses per user
  const userExpenses = (transactions || []).reduce((acc, t) => {
    if (t.created_by) {
      acc[t.created_by] = (acc[t.created_by] || 0) + Number(t.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  // Build the unified data array, excluding superadmins
  const usersWithFinancials = users
    .filter(u => u.role !== "superadmin")
    .map(u => {
      const totalExpenses = userExpenses[u.id] || 0;
      const cashAdvance = u.cash_advance || 0;
      return {
        id: u.id,
        full_name: u.full_name,
        role: u.role,
        cash_advance: cashAdvance,
        total_expenses: totalExpenses,
        balance: cashAdvance - totalExpenses
      };
    });

  const tCashAdvance = await getTranslations("CashAdvance");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-caption-uppercase uppercase text-accent-700">{tCashAdvance("title")}</p>
        <h1 className="mt-1 text-display-md text-ink-800">{tCashAdvance("subtitle")}</h1>
      </div>

      <CashAdvanceManagement 
        initialUsers={usersWithFinancials} 
      />
    </div>
  );
}
