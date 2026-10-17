import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFolderPath, ensureFolderPath } from "@/lib/mega";

// Logging in to Mega and loading the tree can take a while.
export const maxDuration = 60;

// Creates the case's Mega folder so it exists before any file is uploaded.
// Safe to call more than once: existing folders are reused.
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Goes through RLS, so only cases the user can see get a folder.
  const { data: caseData } = await supabase
    .from("cases")
    .select("title, clients!cases_client_id_fkey(name)")
    .eq("id", caseId)
    .single();

  if (!caseData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientName = (caseData.clients as { name: string }).name;

  try {
    await ensureFolderPath(buildFolderPath(clientName, caseData.title, caseId));
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create folder";
    const status = message === "MEGA_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
