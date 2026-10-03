// Case files are uploaded from the browser straight to this private Supabase
// Storage bucket (bypassing Vercel's 4.5 MB request body limit), then moved to
// Mega by the API route and deleted from the bucket.
export const CASE_UPLOADS_BUCKET = "case-uploads";

// Must match file_size_limit on the bucket in supabase/schema.sql.
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function stagingPrefix(userId: string, caseId: string): string {
  return `${userId}/${caseId}/`;
}
