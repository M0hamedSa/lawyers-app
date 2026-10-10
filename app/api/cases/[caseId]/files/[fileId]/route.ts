import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFolderPath, deleteFile } from "@/lib/mega";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; fileId: string }> },
) {
  const { caseId, fileId } = await params;

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

  // Regular users can upload files but not delete them.
  const { data: currentUser } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data: dbFile, error: fetchError } = await supabase
      .from("case_files")
      .select("*")
      .eq("id", fileId)
      .eq("case_id", caseId)
      .single();

    if (fetchError || !dbFile) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const { data: caseData } = await supabase
      .from("cases")
      .select("title, clients!cases_client_id_fkey(name)")
      .eq("id", caseId)
      .single();

    // Many-to-one joins come back as an object at runtime, though the
    // inferred type is an array — accept both.
    const client = caseData?.clients as unknown as { name: string } | { name: string }[] | null;
    const clientName = (Array.isArray(client) ? client[0]?.name : client?.name) ?? "";
    const caseTitle = caseData ? caseData.title : "";
    const folderPath = buildFolderPath(clientName, caseTitle, caseId);

    // Delete the row first: RLS allows it for anyone with access to the case,
    // and if it's refused we haven't touched Mega. If the Mega delete then
    // fails, the folder sync re-adds the row on the next list.
    const { data: deleted, error: deleteError } = await supabase
      .from("case_files")
      .delete()
      .eq("id", fileId)
      .select("id");

    if (deleteError) throw deleteError;
    if (!deleted?.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteFile(dbFile.mega_node_id, {
      folderPath,
      filename: dbFile.filename,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
