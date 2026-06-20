import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getFileBuffer } from "@/lib/mega";

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

    const buffer = await getFileBuffer(dbFile.mega_node_id);

    const isDownload = request.nextUrl.searchParams.get("download") === "1";
    const disposition = isDownload ? "attachment" : "inline";
    const safeFilename = dbFile.filename.replace(/[^\x20-\x7E]/g, "_");
    const encodedFilename = encodeURIComponent(dbFile.filename);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": dbFile.mime_type || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to download file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
