"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
};

export function Modal({ title, open, onClose, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-800/50 p-0 pt-8 sm:items-center sm:p-4 dark:bg-black/60">
      <div
        className={cn(
          "max-h-[calc(100dvh-1rem)] w-full max-w-lg overflow-y-auto overflow-x-hidden rounded-t-xl bg-white shadow-elevated sm:rounded-xl dark:border dark:border-ink-800 dark:bg-ink-900",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-5 py-4 dark:border-ink-800 dark:bg-ink-900 sm:px-6 sm:py-4">
          <h2 className="text-title-sm text-ink-800 dark:text-ink-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700 dark:text-ink-500 dark:hover:bg-ink-800 dark:hover:text-ink-200"
            aria-label="Close modal"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="p-5 sm:p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
