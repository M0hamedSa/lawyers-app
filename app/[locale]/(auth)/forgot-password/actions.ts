"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function resetPasswordAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");

  if (!email) {
    return { error: "Email is required" };
  }

  const headersList = await headers();

  // Build origin robustly — works in local dev, Vercel, and behind proxies
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const proto = headersList.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/${locale}/set-password`,
  });

  if (error) {
    // Surface rate limit errors clearly
    if (error.message.toLowerCase().includes("rate") || error.status === 429) {
      return { error: "rate_limited" };
    }
    return { error: error.message };
  }

  return { success: true };
}
