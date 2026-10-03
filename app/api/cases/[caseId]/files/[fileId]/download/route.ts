import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Readable } from "node:stream";
import { buildFolderPath, getFileStream } from "@/lib/mega";

export async function GET(
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

    const { stream, size } = await getFileStream(dbFile.mega_node_id, {
      folderPath,
      filename: dbFile.filename,
    });

    const isDownload = request.nextUrl.searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    const safeFilename = dbFile.filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(dbFile.filename);

    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": dbFile.mime_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
        ...(size > 0 && { "Content-Length": String(size) }),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to download file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
