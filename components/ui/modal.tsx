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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    /* Backdrop — centered on ALL screen sizes */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      {/* Panel — stops click propagation so clicking inside doesn't close */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // sizing: full width on mobile, capped on tablet+
          "w-full max-w-sm sm:max-w-md",
          // height: never taller than the viewport minus 80px (nav bars)
          "max-h-[calc(100dvh-80px)] overflow-y-auto overflow-x-hidden",
          // shape & background
          "rounded-xl bg-white dark:border dark:border-ink-800 dark:bg-ink-900",
          className,
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-900 sm:px-5 sm:py-4">
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

        {/* Body */}
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
