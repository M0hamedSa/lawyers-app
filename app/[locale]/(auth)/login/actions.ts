"use server";

import { createClient } from "@/lib/supabase/server";


export async function signInAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "missing_fields" };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "invalid_credentials" };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "invalid_credentials" };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.status === "closed") {
    await supabase.auth.signOut();
    return { error: "account_closed" };
  }

  // Ensure user exists in public.users to satisfy RLS/FK constraints
  await supabase.from("users").upsert({
    id: user.id,
    full_name: user.email?.split("@")[0] || "User",
    role: "user",
  }, { onConflict: "id", ignoreDuplicates: true });

  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}
