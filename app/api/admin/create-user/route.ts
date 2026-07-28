import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: caller },
    } = await supabase.auth.getUser();

    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!profile || profile.role !== "superadmin") {
      return NextResponse.json({ error: "Forbidden: Superadmin only" }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, full_name, role } = body || {};

    if (!email?.trim() || !password?.trim() || !full_name?.trim()) {
      return NextResponse.json(
        { error: "Email, password, and full name are required" },
        { status: 400 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    if (serviceKey) {
      const adminSupabase = createAdminClient<Database>(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
        email: email.trim(),
        password: password.trim(),
        email_confirm: true,
        user_metadata: { full_name: full_name.trim(), role: role || "user" },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      if (newUser.user) {
        await adminSupabase
          .from("users")
          .update({ role: role || "user", full_name: full_name.trim() })
          .eq("id", newUser.user.id);
      }

      return NextResponse.json({ ok: true });
    } else {
      // Fallback using temp client signUp when service role key isn't provided locally
      const tempSupabase = createAdminClient<Database>(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          data: {
            full_name: full_name.trim(),
            role: role || "user",
          },
        },
      });

      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }

      if (signUpData.user) {
        // Update user role using superadmin's session client
        await supabase
          .from("users")
          .update({ role: role || "user", full_name: full_name.trim() })
          .eq("id", signUpData.user.id);
      }

      return NextResponse.json({ ok: true });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
