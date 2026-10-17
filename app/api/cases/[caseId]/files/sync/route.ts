import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFolderPath } from "@/lib/mega";
import { syncCaseFilesFromMega } from "@/lib/case-files-sync";

// Logging in to Mega and loading the tree can take a while.
export const maxDuration = 60;

// Adds files that were put straight into the case's Mega folder and returns
// only those, so the files tab can show the database list first and merge
// these in when they arrive.
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Goes through RLS, so this only syncs cases the user can see.
  const { data: caseData } = await supabase
    .from("cases")
    .select("title, clients!cases_client_id_fkey(name)")
    .eq("id", caseId)
    .single();

  if (!caseData) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientName = (caseData.clients as { name: string }).name;

  try {
    const addedIds = await syncCaseFilesFromMega([
      { id: caseId, folderPath: buildFolderPath(clientName, caseData.title, caseId) },
    ]);
    if (!addedIds.length) return NextResponse.json({ files: [] });

    const { data: files, error } = await supabase
      .from("case_files")
      .select("*")
      .in("id", addedIds)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ files });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to sync files";
    const status = message === "MEGA_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
