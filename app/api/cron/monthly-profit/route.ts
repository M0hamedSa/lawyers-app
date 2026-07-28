import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  
  // Verify Vercel Cron Secret (if configured)
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key to bypass RLS and insert transactions
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new NextResponse("Missing Supabase credentials", { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey);

  // Get current day of the month
  const today = new Date();
  const currentDay = today.getDate();

  // Find clients with monthly profit due today
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, profit")
    .eq("profit_type", "monthly")
    .eq("monthly_payment_day", currentDay)
    .eq("status", "active");

  if (clientsError) {
    console.error("Error fetching clients:", clientsError);
    return new NextResponse("Internal Server Error", { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, message: "No clients due for profit today", count: 0 });
  }

  // Prepare transactions
  const transactionsToInsert = clients
    .filter((client) => client.profit && client.profit > 0)
    .map((client) => ({
      client_id: client.id,
      type: "system" as const, 
      amount: client.profit!,
      description: "Monthly Profit",
      voucher_type: "other" as const,
    }));

  if (transactionsToInsert.length === 0) {
    return NextResponse.json({ success: true, message: "No profit amounts to process", count: 0 });
  }

  const { error: insertError } = await supabase
    .from("transactions")
    .insert(transactionsToInsert);

  if (insertError) {
    console.error("Error inserting profit transactions:", insertError);
    return new NextResponse("Failed to insert transactions", { status: 500 });
  }

  return NextResponse.json({ 
    success: true, 
    message: "Monthly profit transactions created successfully", 
    count: transactionsToInsert.length 
  });
}
