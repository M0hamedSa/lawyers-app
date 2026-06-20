"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, inputClassName } from "@/components/ui/field";
import { Link } from "@/i18n/routing";

export default function SetPasswordPage() {
  const t = useTranslations("SetPassword");
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<"checking" | "ready" | "invalid" | "success">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function clearPasswordResetCookie() {
    document.cookie = "password_reset=0; path=/; max-age=0; SameSite=Lax";
  }

  function limitAuthTokenLifespan() {
    const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(
      /https:\/\/(.+)\.supabase\.co/,
    )?.[1];
    if (!ref) return;
    const name = `sb-${ref}-auth-token`;
    const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    if (!match) return;
    const value = match.slice(name.length + 1);
    document.cookie = `${name}=${value}; path=/; max-age=120; SameSite=Lax; Secure`;
  }

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      try {
        // First check if supabase-js already handled the auth (auto-detection
        // with flowType: 'pkce' processes ?code= during client init).
        const existing = await supabase.auth.getSession();
        if (existing.data.session) {
          limitAuthTokenLifespan();
          setPhase("ready");
          return;
        }

        const url = new URL(window.location.href);

        // PKCE flow (?code=…) — supabase-js auto-detection may have already
        // consumed the code, so retry getSession if exchangeCodeForSession fails.
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            const retry = await supabase.auth.getSession();
            if (retry.data.session) {
              limitAuthTokenLifespan();
              setPhase("ready");
              return;
            }
            if (!cancelled) setError(exchangeErr.message);
            setPhase("invalid");
            return;
          }
          window.history.replaceState(null, "", url.pathname);
          limitAuthTokenLifespan();
          setPhase("ready");
          return;
        }

        // Implicit flow (#access_token=…) — fallback for legacy email links.
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionErr) {
              if (!cancelled) setError(sessionErr.message);
              setPhase("invalid");
              return;
            }
            window.history.replaceState(null, "", url.pathname);
            limitAuthTokenLifespan();
            setPhase("ready");
            return;
          }
        }

        if (!cancelled) setPhase("invalid");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("invalidLink"));
          setPhase("invalid");
        }
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [supabase, t]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");

    if (password.length < 8) {
      setError(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }

    setPending(true);
    setError(null);

    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setPending(false);
      return;
    }

    setPending(false);
    clearPasswordResetCookie();
    await supabase.auth.signOut();
    setPhase("success");
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-ink-950">
        <Loader2 className="size-10 animate-spin text-accent-500" aria-hidden />
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-ink-950">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center">
          <div className="flex size-12 items-center justify-center shrink-0">
            <Image src="/logo.png" alt="Logo" width={48} height={48} className="w-full h-full rounded-full object-cover" />
          </div>
          <h1 className="mt-6 text-display-sm text-ink-800 dark:text-ink-100">{t("invalidTitle")}</h1>
            <p className="mt-2 text-body-md text-ink-600 dark:text-ink-300">{error ?? t("invalidLink")}</p>
          </div>
          <Link
            href="/login"
            className="inline-block text-body-md font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
          >
            {t("goToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-ink-950">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center">
            <div className="flex size-12 items-center justify-center shrink-0">
              <Image src="/logo.png" alt="Logo" width={48} height={48} className="w-full h-full rounded-full object-cover" />
            </div>
            <h1 className="mt-6 text-display-sm text-ink-800 dark:text-ink-100">{t("successTitle")}</h1>
            <p className="mt-2 text-body-md text-ink-600 dark:text-ink-300">{t("successMessage")}</p>
          </div>
          <Link
            href="/login"
            className="inline-block text-body-md font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
          >
            {t("goToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-ink-950">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex size-12 items-center justify-center shrink-0">
            <Image src="/logo.png" alt="Logo" width={48} height={48} className="w-full h-full rounded-full object-cover" />
          </div>
          <h2 className="mt-6 text-center text-display-lg text-ink-800 dark:text-ink-100">
            {t("title")}
          </h2>
          <p className="mt-2 text-center text-body-md text-ink-600 dark:text-ink-300">{t("subtitle")}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
                  {error}
                </div>
              )}

              <Field label={t("password")}>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputClassName}
                  dir="ltr"
                />
              </Field>

              <Field label={t("confirm")}>
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className={inputClassName}
                  dir="ltr"
                />
              </Field>

              <ActionButton type="submit" className="w-full justify-center" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submit")
                )}
              </ActionButton>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
