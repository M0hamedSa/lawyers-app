import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caseData } = await supabase
    .from("cases")
    .select("created_by, client_id")
    .eq("id", caseId)
    .single();

  if (!caseData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== "superadmin" && caseData.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const allowedFields: Record<string, unknown> = {};
  if (body.title !== undefined) allowedFields.title = body.title;
  if (body.description !== undefined) allowedFields.description = body.description;
  if (body.status !== undefined) allowedFields.status = body.status;
  if (body.profit_amount !== undefined) allowedFields.profit_amount = body.profit_amount;

  const { data, error } = await supabase
    .from("cases")
    .update(allowedFields)
    .eq("id", caseId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caseData } = await supabase
    .from("cases")
    .select("created_by")
    .eq("id", caseId)
    .single();

  if (!caseData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentUser?.role !== "superadmin" && caseData.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("cases")
    .delete()
    .eq("id", caseId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
