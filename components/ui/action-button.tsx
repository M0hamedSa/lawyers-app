"use client";

import { cn } from "@/lib/utils";
import { useScaleHover } from "@/lib/animations";

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  size?: "default" | "sm";
};

export function ActionButton({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ActionButtonProps) {
  const hoverRef = useScaleHover<HTMLButtonElement>();

  return (
    <button
      ref={hoverRef}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md text-btn transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-1",
        size === "default" && "h-10 px-[18px]",
        size === "sm" && "h-8 px-3 text-[13px]",
        variant === "primary" &&
          "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-700 shadow-subtle dark:bg-accent-500 dark:text-white dark:hover:bg-accent-600 dark:active:bg-accent-700",
        variant === "secondary" &&
          "border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 hover:text-ink-800 active:bg-ink-100 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-ink-100 dark:active:bg-ink-700",
        variant === "danger" && "bg-error-500 text-white hover:bg-error-600 active:bg-error-700 shadow-subtle",
        className,
      )}
      {...props}
    />
  );
}
