import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFolderPath, uploadFile } from "@/lib/mega";

async function getCaseContext(supabase: ReturnType<typeof createServerClient>, caseId: string) {
  const { data: caseData } = await supabase
    .from("cases")
    .select("title, clients!cases_client_id_fkey(name)")
    .eq("id", caseId)
    .single();

  if (!caseData) return null;

  const clientName = (caseData.clients as { name: string }).name;
  const caseTitle = caseData.title;
  return {
    clientName,
    caseTitle,
    folderPath: buildFolderPath(clientName, caseTitle, caseId),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;

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
    const { data: files, error } = await supabase
      .from("case_files")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ files });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;

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
    const context = await getCaseContext(supabase, caseId);
    if (!context) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const mega = await uploadFile(context.folderPath, file.name, buffer);

    const { data: dbFile, error } = await supabase
      .from("case_files")
      .insert({
        case_id: caseId,
        filename: file.name,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        mega_node_id: mega.nodeId,
        mega_parent_id: mega.parentId,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ file: dbFile }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to upload file";
    const status = message === "MEGA_NOT_CONFIGURED" ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
