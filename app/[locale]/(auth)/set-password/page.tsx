"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, inputClassName } from "@/components/ui/field";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Link } from "@/i18n/routing";

export default function SetPasswordPage() {
  const t = useTranslations("SetPassword");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [phase, setPhase] = useState<"checking" | "ready" | "invalid">("checking");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeErr) {
            if (!cancelled) {
              setError(exchangeErr.message);
              setPhase("invalid");
            }
            return;
          }
          window.history.replaceState(null, "", `${url.pathname}${url.hash}`);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (!session) {
          setPhase("invalid");
          return;
        }

        setPhase("ready");
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

    router.push("/dashboard");
    router.refresh();
  }

  if (phase === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 dark:bg-[#121210]">
        <Loader2 className="size-10 animate-spin text-brass-600" aria-hidden />
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-[#121210]">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex flex-col items-center">
            <div className="flex size-12 items-center justify-center shrink-0">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="mt-6 text-xl font-semibold text-ink-900 dark:text-ink-50">{t("invalidTitle")}</h1>
            <p className="mt-2 text-sm text-ink-700 dark:text-ink-300">{error ?? t("invalidLink")}</p>
          </div>
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-brass-700 hover:text-brass-800 dark:text-brass-400 dark:hover:text-brass-300"
          >
            {t("goToLogin")}
          </Link>
          <div className="pt-4">
            <ThemeToggle />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-[#121210]">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex size-12 items-center justify-center shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {t("title")}
          </h2>
          <p className="mt-2 text-center text-sm text-ink-700 dark:text-ink-300">{t("subtitle")}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
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

        <div className="pt-4">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
