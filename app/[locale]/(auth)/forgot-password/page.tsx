"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, inputClassName } from "@/components/ui/field";
import { resetPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPassword");
  const locale = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);
    
    const formData = new FormData(event.currentTarget);
    const result = await resetPasswordAction(formData);
    
    if (result.error) {
      setError(result.error === "rate_limited" ? t("rateLimited") : t("error"));
      setPending(false);
    } else if (result.success) {
      setSuccess(true);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-ink-950">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center">
          <div className="flex size-24 items-center justify-center shrink-0">
            <Image src="/logo.png" alt="Logo" width={96} height={96} className="w-full h-full rounded-full object-cover" />
          </div>
          <h2 className="mt-6 text-center text-display-lg text-ink-800 dark:text-ink-100">
            {t("title")}
          </h2>
          <p className="mt-2 text-center text-body-md text-ink-600 dark:text-ink-300">
            {t("subtitle")}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {success ? (
              <div className="space-y-6 text-center">
                <div className="rounded-md border border-success-200 bg-success-50 p-4 text-body-md text-success-700 dark:border-success-900/50 dark:bg-success-950/40 dark:text-success-200">
                  {t("success")}
                </div>
                <Link
                  href="/login"
                  className="inline-block text-body-md font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
                >
                  {t("backToLogin")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <input type="hidden" name="locale" value={locale} />
                {error && (
                  <div className="rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700 dark:border-error-900/50 dark:bg-error-950/40 dark:text-error-200">
                    {error}
                  </div>
                )}
                
                <Field label={t("email")}>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
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

                <div className="text-center pt-2">
                  <Link
                    href="/login"
                    className="text-body-sm font-medium text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200"
                  >
                    {t("backToLogin")}
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
