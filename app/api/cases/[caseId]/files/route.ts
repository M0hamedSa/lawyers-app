import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { buildFolderPath, uploadFile } from "@/lib/mega";
import { createAdminClient } from "@/lib/supabase/admin";
import { CASE_UPLOADS_BUCKET, stagingPrefix } from "@/lib/case-uploads";
import { syncCaseFilesFromMega } from "@/lib/case-files-sync";

// Moving a large file from storage to Mega can take a while.
export const maxDuration = 60;

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
    // getCaseContext goes through RLS, so this only syncs cases the user can see.
    const context = await getCaseContext(supabase, caseId);
    if (context) {
      try {
        await syncCaseFilesFromMega([{ id: caseId, folderPath: context.folderPath }]);
      } catch (e) {
        // Still list what's in the database if Mega is unreachable.
        console.error("Mega sync failed", e);
      }
    }

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

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }
  let stagedPath: string | null = null;

  try {
    const context = await getCaseContext(supabase, caseId);
    if (!context) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const { path, filename, mimeType } = (await request.json()) as {
      path?: string;
      filename?: string;
      mimeType?: string;
    };
    if (!path || !filename) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    // Only accept staged objects this user uploaded for this case.
    if (!path.startsWith(stagingPrefix(user.id, caseId)) || path.includes("..")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    stagedPath = path;

    const { data: blob, error: downloadError } = await admin.storage
      .from(CASE_UPLOADS_BUCKET)
      .download(path);
    if (downloadError || !blob) {
      return NextResponse.json({ error: "Uploaded file not found" }, { status: 400 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    const mega = await uploadFile(context.folderPath, filename, buffer);

    const { data: dbFile, error } = await supabase
      .from("case_files")
      .insert({
        case_id: caseId,
        filename,
        file_size: buffer.length,
        mime_type: mimeType || "application/octet-stream",
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
  } finally {
    // The staged copy is only needed until it reaches Mega.
    if (stagedPath) {
      await admin.storage.from(CASE_UPLOADS_BUCKET).remove([stagedPath]);
    }
  }
}
