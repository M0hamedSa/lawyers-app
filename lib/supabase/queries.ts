import { createClient } from "@/lib/supabase/server";
import { NOTIFICATIONS_PAGE_SIZE } from "@/lib/supabase/types";
import type { AppNotification, CasePriority, ClientWithSummary, LedgerTransaction, Task } from "@/lib/supabase/types";

type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  profit_type: "monthly" | "per_case";
  profit: number | null;
  status: "active" | "inactive";
  monthly_payment_day: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  transactions: { amount: number; type: "payment" | "expense" | "profit" | "office" | "system"; created_by?: string; is_cleared?: boolean }[];
  creator?: { full_name: string } | null;
  cases?: { updated_at: string }[];
};

function lastActivityAt(client: ClientRow): number {
  const caseTimestamps = (client.cases ?? []).map((c) => new Date(c.updated_at).getTime());
  return Math.max(new Date(client.updated_at).getTime(), ...caseTimestamps);
}

export type CaseRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  status: string;
  priority: CasePriority;
  profit_amount: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  transactions: { amount: number; type: "payment" | "expense" | "office"; created_by?: string; is_cleared?: boolean }[];
  case_assignees: { user_id: string; users: { full_name: string } | null }[];
};

type SummaryUser = { id: string; role: string };

function withSummary(client: ClientRow, currentUser: SummaryUser | null = null): ClientWithSummary {
  const totals = client.transactions.reduce(
    (acc, transaction) => {
      // If not superadmin, only sum their own transactions
      if (currentUser && currentUser.role !== "superadmin" && transaction.created_by !== currentUser.id) {
        return acc;
      }
      if (transaction.type === "profit" || transaction.type === "system") {
        acc.total_profit += Number(transaction.amount);
      } else {
        if (transaction.type === "payment" && !transaction.is_cleared) acc.total_payments += Number(transaction.amount);
        if (transaction.type === "expense") acc.total_expenses += Number(transaction.amount);
      }
      return acc;
    },
    { total_payments: 0, total_expenses: 0, total_profit: 0 },
  );

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    profit_type: client.profit_type,
    profit: client.profit,
    status: client.status,
    monthly_payment_day: client.monthly_payment_day,
    created_by: client.created_by,
    created_at: client.created_at,
    updated_at: client.updated_at,
    total_payments: totals.total_payments,
    total_expenses: totals.total_expenses,
    total_profit: totals.total_profit,
    balance: totals.total_payments - totals.total_expenses,
    creator_name: client.creator?.full_name || null,
  };
}

export function caseWithSummary(c: CaseRow, currentUser: SummaryUser | null = null) {
  const totals = c.transactions.reduce(
    (acc, transaction) => {
      if (currentUser && currentUser.role !== "superadmin" && transaction.created_by !== currentUser.id) {
        return acc;
      }
      if (transaction.type === "payment" && !transaction.is_cleared) acc.total_payments += Number(transaction.amount);
      if (transaction.type === "expense") acc.total_expenses += Number(transaction.amount);
      return acc;
    },
    { total_payments: 0, total_expenses: 0 },
  );

  return {
    id: c.id,
    client_id: c.client_id,
    title: c.title,
    description: c.description,
    status: c.status,
    priority: c.priority,
    profit_amount: c.profit_amount,
    created_by: c.created_by,
    created_at: c.created_at,
    updated_at: c.updated_at,
    total_payments: totals.total_payments,
    total_expenses: totals.total_expenses,
    balance: totals.total_payments - totals.total_expenses,
    assignees: (c.case_assignees ?? []).map((a) => ({
      id: a.user_id,
      full_name: a.users?.full_name ?? "",
    })),
  };
}

export async function getClients() {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, creator:users!clients_created_by_fkey(full_name), transactions(amount, type, created_by, is_cleared), cases(updated_at)");

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as ClientRow[];
  rows.sort((a, b) => lastActivityAt(b) - lastActivityAt(a));

  return rows.map((client) => withSummary(client, currentUser));
}

export async function getClient(id: string) {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*, creator:users!clients_created_by_fkey(full_name), transactions(amount, type, created_by, is_cleared)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return withSummary(data as ClientRow, currentUser);
}

export async function getClientTransactions(clientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, cases(title), users!transactions_created_by_fkey(full_name)")
    .eq("client_id", clientId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as (LedgerTransaction & { cases: { title: string } | null; users: { full_name: string } | null })[];
}

export async function getCases(clientId: string) {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("*, transactions(amount, type, created_by, is_cleared), case_assignees(user_id, users!case_assignees_user_id_fkey(full_name))")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => caseWithSummary(c as CaseRow, currentUser));
}

export async function getCase(caseId: string) {
  const currentUser = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cases")
    .select("*, transactions(amount, type, created_by), case_assignees(user_id, users!case_assignees_user_id_fkey(full_name))")
    .eq("id", caseId)
    .single();

  if (error) throw new Error(error.message);
  return caseWithSummary(data as CaseRow, currentUser);
}

export async function getCaseTransactions(caseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, users!transactions_created_by_fkey(full_name)")
    .eq("case_id", caseId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as (LedgerTransaction & { users: { full_name: string } | null })[];
}

type TaskAssigneeRow = {
  id: string;
  case_id: string;
  user_id: string;
  assigned_by: string | null;
  created_at: string;
  cases: {
    title: string;
    status: string;
    priority: CasePriority;
    client_id: string;
    clients: { name: string } | null;
  };
  assignee: { full_name: string } | null;
  assigner: { full_name: string } | null;
};

export async function getTasks(filters: { priority?: CasePriority; userId?: string } = {}): Promise<Task[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  const isManager = currentUser.role === "admin" || currentUser.role === "superadmin";
  const scopedUserId = isManager ? filters.userId : currentUser.id;

  const supabase = await createClient();
  let query = supabase
    .from("case_assignees")
    .select(
      "id, case_id, user_id, assigned_by, created_at, cases!inner(title, status, priority, client_id, clients(name)), assignee:users!case_assignees_user_id_fkey(full_name), assigner:users!case_assignees_assigned_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false });

  if (scopedUserId) query = query.eq("user_id", scopedUserId);
  if (filters.priority) query = query.eq("cases.priority", filters.priority);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as TaskAssigneeRow[]).map((row) => ({
    id: row.id,
    case_id: row.case_id,
    case_title: row.cases.title,
    case_status: row.cases.status,
    priority: row.cases.priority,
    client_id: row.cases.client_id,
    client_name: row.cases.clients?.name ?? "",
    user_id: row.user_id,
    user_name: row.assignee?.full_name ?? "",
    assigned_by: row.assigned_by,
    assigned_by_name: row.assigner?.full_name ?? null,
    created_at: row.created_at,
  }));
}

export async function getDashboardData() {
  const currentUser = await getCurrentUser();

  const clients = await getClients();

  let totalBalance = 0;
  let totalPayments = 0;
  let totalExpenses = 0;
  let totalProfit = 0;

  if (currentUser?.role === "superadmin") {
    totalBalance = clients.reduce((sum, client) => sum + client.balance, 0);
    totalPayments = clients.reduce((sum, client) => sum + client.total_payments, 0);
    totalExpenses = clients.reduce((sum, client) => sum + client.total_expenses, 0);
    
    const monthlyProfit = clients.reduce((sum, client) => sum + client.total_profit, 0);
    const { data: casesData } = await (await createClient())
      .from("cases")
      .select("profit_amount");
    const casesProfit = (casesData || []).reduce((sum, c) => sum + (c.profit_amount || 0), 0);
    totalProfit = monthlyProfit + casesProfit;
  } else {
    // For normal users, fetch their financials
    const financials = await getUserFinancials();
    if (financials) {
      totalPayments = financials.cashAdvance;
      totalExpenses = financials.totalExpenses;
      totalBalance = financials.balance;
    }
  }

  const { data: transactionsData } = await (await createClient())
    .from("transactions")
    .select("amount, type, voucher_type, date, client_id, clients(name)");

  const transactions = transactionsData || [];

  // Cash Flow (Last 6 Months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1); // Start of the 6th month ago
  
  const cashFlowMap = new Map<string, { month: string; payments: number; expenses: number }>();
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
    cashFlowMap.set(monthKey, { month: monthKey, payments: 0, expenses: 0 });
  }

  // Voucher Types
  const voucherTypesMap = new Map<string, number>();

  transactions.forEach(t => {
    // Voucher types aggregation
    const vType = t.voucher_type || "cash";
    voucherTypesMap.set(vType, (voucherTypesMap.get(vType) || 0) + Number(t.amount));

    // Cash flow aggregation
    const dateObj = new Date(t.date);
    if (dateObj >= sixMonthsAgo) {
      const monthKey = t.date.slice(0, 7); // YYYY-MM
      if (cashFlowMap.has(monthKey)) {
        const entry = cashFlowMap.get(monthKey)!;
        if (t.type === "payment") entry.payments += Number(t.amount);
        if (t.type === "expense") entry.expenses += Number(t.amount);
      }
    }
  });

  const cashFlow = Array.from(cashFlowMap.values()).reverse(); // Chronological order
  
  const voucherTypes = Array.from(voucherTypesMap.entries()).map(([name, value]) => ({ name, value }));

  // Top Clients by payments (using the already fetched 'clients')
  const topClients = [...clients]
    .sort((a, b) => b.total_payments - a.total_payments)
    .slice(0, 5)
    .map(c => ({ name: c.name, payments: c.total_payments, expenses: c.total_expenses }));

  // Client Financials (Top 10 by volume)
  const clientFinancials = [...clients]
    .sort((a, b) => (b.total_payments + b.total_expenses) - (a.total_payments + a.total_expenses))
    .slice(0, 10)
    .map(c => ({ name: c.name, payments: c.total_payments, expenses: c.total_expenses }));

  const incomeExpenseRatio = [
    { name: "Payments", value: totalPayments },
    { name: "Expenses", value: totalExpenses }
  ];

  return {
    clients,
    totalClients: clients.length,
    totalBalance,
    totalPayments,
    totalExpenses,
    totalProfit,
    userRole: currentUser?.role || null,
    chartData: {
      cashFlow,
      topClients,
      clientFinancials,
      voucherTypes,
      incomeExpenseRatio
    }
  };
}
export async function getAllTransactions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, clients(name, profit, profit_type), cases(title), users!transactions_created_by_fkey(full_name)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as (LedgerTransaction & { clients: { name: string; profit: number | null; profit_type: string }; cases: { title: string } | null; users: { full_name: string } })[];
}

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, role, full_name, status")
    .eq("id", user.id)
    .single();

  if (error || data.status === "closed") return null;

  const { data: advances } = await supabase
    .from("cash_advances")
    .select("amount")
    .eq("user_id", user.id);

  const cashAdvance = (advances || []).reduce((sum, a) => sum + Number(a.amount), 0);

  return {
    ...data,
    cash_advance: cashAdvance
  } as { id: string; role: "superadmin" | "admin" | "user"; full_name: string; cash_advance: number };
}

export async function getUserRole() {
  const user = await getCurrentUser();
  return user?.role || null;
}

export async function getUserFinancials() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;

  const supabase = await createClient();
  const [txResult, advanceResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount")
      .eq("created_by", currentUser.id)
      .in("type", ["expense", "office"]),
    supabase
      .from("cash_advances")
      .select("amount")
      .eq("user_id", currentUser.id)
  ]);

  const totalExpenses = (txResult.data || []).reduce((sum, t) => sum + Number(t.amount), 0);
  const cashAdvance = (advanceResult.data || []).reduce((sum, a) => sum + Number(a.amount), 0);
  const balance = cashAdvance - totalExpenses;

  return { cashAdvance, totalExpenses, balance };
}

export async function getNotifications(): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { notifications: [], unreadCount: 0 };
  }

  const supabase = await createClient();
  const [listResult, countResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .is("cleared_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false)
      .is("cleared_at", null),
  ]);

  if (listResult.error) throw new Error(listResult.error.message);

  return { notifications: listResult.data as AppNotification[], unreadCount: countResult.count ?? 0 };
}

export async function getAllNotifications(): Promise<AppNotification[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .range(0, NOTIFICATIONS_PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  return data as AppNotification[];
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
