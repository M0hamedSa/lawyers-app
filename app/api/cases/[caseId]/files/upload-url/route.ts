import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CASE_UPLOADS_BUCKET, MAX_UPLOAD_BYTES, stagingPrefix } from "@/lib/case-uploads";

// Issues a signed URL the browser uses to upload a file directly to the
// staging bucket. The file is then handed to POST /files to move it to Mega.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { size } = (await request.json()) as { size?: number };
    if (typeof size !== "number" || size <= 0) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }
    if (size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "FILE_TOO_LARGE" }, { status: 413 });
    }

    // RLS on cases ensures the user can only get a URL for cases they can see.
    const { data: caseData } = await supabase
      .from("cases")
      .select("id")
      .eq("id", caseId)
      .single();

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const path = `${stagingPrefix(user.id, caseId)}${crypto.randomUUID()}`;
    const { data, error } = await createAdminClient()
      .storage.from(CASE_UPLOADS_BUCKET)
      .createSignedUploadUrl(path);

    if (error) throw error;

    return NextResponse.json({ path: data.path, token: data.token });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to prepare upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
