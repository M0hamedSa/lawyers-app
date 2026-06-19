import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const siteUrl = Deno.env.get("SITE_URL") || "";
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": siteUrl,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (
      profileErr ||
      !profile ||
      (profile.role !== "admin" && profile.role !== "superadmin")
    ) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as {
      email?: string;
      full_name?: string;
      role?: string;
      redirectTo?: string;
    };

    const email = body.email?.trim();
    const full_name = body.full_name?.trim();
    const role = body.role?.trim() || "user";
    const redirectTo = body.redirectTo?.trim();

    if (!email || !full_name) {
      return new Response(
        JSON.stringify({ error: "email and full_name required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const allowedRoles = ["user", "admin", "superadmin"] as const;
    const inviteRole = allowedRoles.includes(role as (typeof allowedRoles)[number])
      ? (role as (typeof allowedRoles)[number])
      : "user";

    if (inviteRole === "superadmin" && profile.role !== "superadmin") {
      return new Response(
        JSON.stringify({ error: "Only superadmin can invite superadmin" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const fallbackRedirect = Deno.env.get("SITE_URL")?.trim();
    const finalRedirect = redirectTo || fallbackRedirect || undefined;

    const { error: inviteError } = await supabaseAdmin.auth.admin
      .inviteUserByEmail(email, {
        data: { full_name, role: inviteRole },
        redirectTo: finalRedirect,
      });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
