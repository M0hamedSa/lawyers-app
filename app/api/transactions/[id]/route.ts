import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: transaction } = await supabase
    .from("transactions")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== "superadmin" && transaction.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields: Record<string, unknown> = {};
  if (body.amount !== undefined) allowedFields.amount = body.amount;
  if (body.description !== undefined) allowedFields.description = body.description;
  if (body.date !== undefined) allowedFields.date = body.date;
  if (body.type !== undefined) allowedFields.type = body.type;
  if (body.voucher_type !== undefined) allowedFields.voucher_type = body.voucher_type;

  const { data, error } = await supabase
    .from("transactions")
    .update(allowedFields)
    .eq("id", id)
    .select("*, users!transactions_created_by_fkey(full_name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: transaction } = await supabase
    .from("transactions")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== "superadmin" && transaction.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
