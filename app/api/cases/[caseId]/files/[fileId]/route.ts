import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { deleteFile } from "@/lib/mega";

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

    const isAdmin = user.role === "superadmin" || user.role === "admin";
    if (dbFile.uploaded_by !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteFile(dbFile.mega_node_id);

    const { error: deleteError } = await supabase
      .from("case_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
