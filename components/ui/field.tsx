import { cn } from "@/lib/utils";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn("grid gap-1.5 text-title-sm text-ink-700 min-w-0 dark:text-ink-300", className)}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

export const inputClassName =
  "h-[44px] rounded-lg border border-ink-200 bg-white px-4 text-body-md text-ink-800 outline-none transition-all duration-150 placeholder:text-ink-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15 focus:shadow-subtle dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:focus:border-accent-500 dark:focus:ring-accent-500/20";

export const textareaClassName =
  "min-h-24 w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-body-md text-ink-800 outline-none transition-all duration-150 placeholder:text-ink-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/15 focus:shadow-subtle dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:focus:border-accent-500 dark:focus:ring-accent-500/20";
