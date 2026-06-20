"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, inputClassName } from "@/components/ui/field";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { signInAction } from "./actions";

export default function LoginPage() {
  const t = useTranslations("Login");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    
    const formData = new FormData(event.currentTarget);
    const result = await signInAction(formData);
    
    if (result.error) {
      setError(t("error"));
      setPending(false);
    } else if (result.success) {
      router.push("/dashboard");
    }
  }

  return (
    <div suppressHydrationWarning className="relative flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12 sm:px-6 lg:px-8 dark:bg-ink-950">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md border border-error-200 bg-error-50 p-3 text-body-sm text-error-700">
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

              <div className="grid gap-1.5 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-title-sm text-ink-700 dark:text-ink-300">{t("password")}</span>
                  <Link 
                    href="/forgot-password" 
                    className="text-body-sm font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300"
                  >
                    {t("forgotPassword")}
                  </Link>
                </div>
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className={inputClassName + " w-full"}
                  dir="ltr"
                />
              </div>

              <ActionButton type="submit" className="w-full justify-center" disabled={pending}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("submit")}
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
