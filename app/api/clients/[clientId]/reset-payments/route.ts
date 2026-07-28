import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Check user role
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role !== "superadmin") {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Update transactions for this client: mark all 'payment' types as is_cleared = true
    const { error: updateError } = await supabase
      .from("transactions")
      .update({ is_cleared: true })
      .eq("client_id", clientId)
      .eq("type", "payment")
      .eq("is_cleared", false); // Only update those not already cleared

    if (updateError) {
      console.error("Error resetting payments:", updateError);
      return new NextResponse(JSON.stringify({ error: "Failed to reset payments" }), { status: 500 });
    }

    return new NextResponse(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Exception resetting payments:", error);
    return new NextResponse(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
