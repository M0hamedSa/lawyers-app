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
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-900/45 p-0 pt-8 sm:items-center sm:p-4 dark:bg-black/70">
      <div
        className={cn(
          "max-h-[min(92dvh,100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-t-lg bg-white shadow-soft sm:rounded-md dark:border dark:border-ink-600 dark:bg-ink-900 dark:shadow-none",
          className,
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 dark:border-ink-700 dark:bg-ink-900 sm:px-5 sm:py-4">
          <h2 className="text-base font-semibold text-ink-900 dark:text-ink-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-md text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800"
            aria-label="Close modal"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
