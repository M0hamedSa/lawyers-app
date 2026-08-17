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
  const filteredUsers = users.filter(u => u.role !== "superadmin");
  
  const supabase = await createClient();
  
  // Fetch all cash advances
  const { data: cashAdvancesResult } = await supabase
    .from("cash_advances")
    .select("*, users!cash_advances_user_id_fkey(full_name)")
    .order("date", { ascending: false });

  // Fetch all expenses to calculate totals
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, created_by")
    .in("type", ["expense", "office"]);

  const cashAdvances = (cashAdvancesResult || []).map(a => ({
    id: a.id,
    user_id: a.user_id,
    amount: Number(a.amount),
    description: a.description,
    date: a.date,
    created_by: a.created_by,
    created_at: a.created_at,
    updated_at: a.updated_at,
    user_name: a.users?.full_name || "-"
  }));

  // Aggregate expenses per user
  const userExpenses = (transactions || []).reduce((acc, t) => {
    if (t.created_by) {
      acc[t.created_by] = (acc[t.created_by] || 0) + Number(t.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  // Aggregate cash advances per user
  const userAdvances = cashAdvances.reduce((acc, a) => {
    acc[a.user_id] = (acc[a.user_id] || 0) + a.amount;
    return acc;
  }, {} as Record<string, number>);

  // Build the unified user data array, excluding superadmins
  // Show active users and any closed users who still have financial records (advances or expenses)
  const usersWithFinancials = filteredUsers
    .filter(u => u.status !== "closed" || (userAdvances[u.id] || 0) > 0 || (userExpenses[u.id] || 0) > 0)
    .map(u => {
      const totalExpenses = userExpenses[u.id] || 0;
      const cashAdvance = userAdvances[u.id] || 0;
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
        initialAdvances={cashAdvances}
        teamMembers={filteredUsers.filter(u => u.status !== "closed").map(u => ({ id: u.id, full_name: u.full_name }))}
      />
    </div>
  );
}
