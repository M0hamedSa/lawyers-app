import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: caseIds } = await supabase
      .from("cases")
      .select("id")
      .eq("client_id", clientId);

    if (!caseIds?.length) {
      return NextResponse.json({ files: [] });
    }

    const { data: files, error } = await supabase
      .from("case_files")
      .select("*, cases!case_files_case_id_fkey(title)")
      .in("case_id", caseIds.map((c) => c.id))
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ files });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
