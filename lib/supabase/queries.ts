import { createClient } from "@/lib/supabase/server";
import type { ClientWithSummary, LedgerTransaction } from "@/lib/supabase/types";

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  profit: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  transactions: { amount: number; type: "payment" | "expense"; created_by?: string }[];
};

type SummaryUser = { id: string; role: string };

function withSummary(client: ClientRow, currentUser: SummaryUser | null = null): ClientWithSummary {
  const totals = client.transactions.reduce(
    (acc, transaction) => {
      // If not superadmin, only sum their own transactions
      if (currentUser && currentUser.role !== "superadmin" && transaction.created_by !== currentUser.id) {
        return acc;
      }
      if (transaction.type === "payment") acc.total_payments += Number(transaction.amount);
      if (transaction.type === "expense") acc.total_expenses += Number(transaction.amount);
      return acc;
    },
    { total_payments: 0, total_expenses: 0 },
  );

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    profit: client.profit,
    created_by: client.created_by,
    created_at: client.created_at,
    updated_at: client.updated_at,
    total_payments: totals.total_payments,
    total_expenses: totals.total_expenses,
    balance: totals.total_payments - totals.total_expenses,
  };
}

export async function getClients() {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, transactions(amount, type, created_by)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((client) => withSummary(client as ClientRow, currentUser));
}

export async function getClient(id: string) {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, transactions(amount, type, created_by)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return withSummary(data as ClientRow, currentUser);
}

export async function getClientTransactions(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as LedgerTransaction[];
}

export async function getDashboardData() {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();

  let txQuery = supabase
    .from("transactions")
    .select("date, amount, type")
    .order("date", { ascending: true });

  if (currentUser && currentUser.role !== "superadmin") {
    txQuery = txQuery.eq("created_by", currentUser.id);
  }

  const [clients, { data: transactionsData, error: transactionsError }] = await Promise.all([
    getClients(),
    txQuery
  ]);

  if (transactionsError) throw new Error(transactionsError.message);

  const byMonth = new Map<string, { month: string; payments: number; expenses: number }>();
  for (const transaction of transactionsData ?? []) {
    const month = String(transaction.date).slice(0, 7);
    const row = byMonth.get(month) ?? { month, payments: 0, expenses: 0 };
    if (transaction.type === "payment") row.payments += Number(transaction.amount);
    if (transaction.type === "expense") row.expenses += Number(transaction.amount);
    byMonth.set(month, row);
  }

  let totalBalance = 0;
  let totalPayments = 0;
  let totalExpenses = 0;

  if (currentUser?.role === "superadmin") {
    totalBalance = clients.reduce((sum, client) => sum + client.balance, 0);
    totalPayments = clients.reduce((sum, client) => sum + client.total_payments, 0);
    totalExpenses = clients.reduce((sum, client) => sum + client.total_expenses, 0);
  } else {
    // For normal users, fetch their financials
    const financials = await getUserFinancials();
    if (financials) {
      totalPayments = financials.cashAdvance;
      totalExpenses = financials.totalExpenses;
      totalBalance = financials.balance;
    }
  }

  return {
    clients,
    totalClients: clients.length,
    totalBalance,
    totalPayments,
    totalExpenses,
    chartData: Array.from(byMonth.values()),
    userRole: currentUser?.role || null,
  };
}
export async function getAllTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, clients(name, profit), users!transactions_created_by_fkey(full_name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as (LedgerTransaction & { clients: { name: string; profit: number | null }; users: { full_name: string } })[];
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, role, full_name, cash_advance")
    .eq("id", user.id)
    .single();

  if (error) return null;
  return data as { id: string; role: "superadmin" | "admin" | "user"; full_name: string; cash_advance: number };
}

export async function getUserRole() {
  const user = await getCurrentUser();
  return user?.role || null;
}

export async function getUserFinancials() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const supabase = await createClient();
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount")
    .eq("created_by", currentUser.id)
    .eq("type", "expense");

  const totalExpenses = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
  const cashAdvance = currentUser.cash_advance || 0;
  const balance = cashAdvance - totalExpenses;

  return { cashAdvance, totalExpenses, balance };
}

export async function getAllUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*, client_access(client_id)")
    .order("full_name", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getAdminClients() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}
