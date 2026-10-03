import { listFilesInFolders } from "@/lib/mega";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type CaseFileInsert = Database["public"]["Tables"]["case_files"]["Insert"];

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

// Adds case_files rows for files that exist in a case's Mega folder but not in
// the database — e.g. files pasted directly into the folder in the Mega app.
// Callers must have already checked the user can access these cases, since
// this writes with the service role. Rows get uploaded_by = null, so only
// admins can delete them.
export async function syncCaseFilesFromMega(
  cases: { id: string; folderPath: string }[],
): Promise<void> {
  if (!cases.length) return;

  const megaFiles = await listFilesInFolders(cases.map((c) => c.folderPath));
  const admin = createAdminClient();

  const { data: existing, error } = await admin
    .from("case_files")
    .select("case_id, filename, mega_node_id")
    .in("case_id", cases.map((c) => c.id));
  if (error) throw error;

  const knownNodeIds = new Set(existing?.map((f) => f.mega_node_id));
  // Rows copied from an old Mega account keep a stale node id, so also match
  // by filename to avoid listing those files twice.
  const knownNames = new Set(existing?.map((f) => `${f.case_id}/${f.filename}`));

  const rows: CaseFileInsert[] = [];
  for (const c of cases) {
    for (const file of megaFiles.get(c.folderPath) ?? []) {
      if (!file.nodeId) continue;
      if (knownNodeIds.has(file.nodeId) || knownNames.has(`${c.id}/${file.name}`)) continue;

      rows.push({
        case_id: c.id,
        filename: file.name,
        file_size: file.size,
        mime_type: guessMimeType(file.name),
        mega_node_id: file.nodeId,
        mega_parent_id: file.parentId,
        uploaded_by: null,
        ...(file.timestamp > 0 && { created_at: new Date(file.timestamp * 1000).toISOString() }),
      });
    }
  }

  if (!rows.length) return;

  // ignoreDuplicates relies on the unique index on mega_node_id, so two
  // overlapping list requests can't insert the same file twice.
  const { error: insertError } = await admin
    .from("case_files")
    .upsert(rows, { onConflict: "mega_node_id", ignoreDuplicates: true });
  if (insertError) throw insertError;
}
