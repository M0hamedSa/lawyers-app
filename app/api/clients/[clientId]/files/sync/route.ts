import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFolderPath } from "@/lib/mega";
import { syncCaseFilesFromMega } from "@/lib/case-files-sync";

// Logging in to Mega and loading the tree can take a while.
export const maxDuration = 60;

// Adds files that were put straight into any of the client's case folders in
// Mega and returns only those, so the files tab can show the database list
// first and merge these in when they arrive.
export async function POST(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Goes through RLS, so this only syncs cases the user can see.
  const { data: cases } = await supabase
    .from("cases")
    .select("id, title, clients!cases_client_id_fkey(name)")
    .eq("client_id", clientId);

  if (!cases?.length) return NextResponse.json({ files: [] });

  try {
    const addedIds = await syncCaseFilesFromMega(
      cases.map((c) => {
        // Many-to-one joins come back as an object at runtime, though the
        // inferred type is an array — accept both.
        const client = c.clients as unknown as { name: string } | { name: string }[] | null;
        const clientName = (Array.isArray(client) ? client[0]?.name : client?.name) ?? "";
        return { id: c.id, folderPath: buildFolderPath(clientName, c.title, c.id) };
      }),
    );
    if (!addedIds.length) return NextResponse.json({ files: [] });

    const { data: files, error } = await supabase
      .from("case_files")
      .select("*, cases!case_files_case_id_fkey(title)")
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
