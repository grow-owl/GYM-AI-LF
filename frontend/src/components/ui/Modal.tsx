import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import clsx from "clsx";

export interface ModalProps {
  onClose: () => void;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

const maxWidthClasses: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
};

export default function Modal({
  onClose,
  maxWidth = "md",
  title,
  subtitle,
  children,
  className,
  showCloseButton = true,
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          "w-full max-h-[85vh] overflow-y-auto rounded-3xl border border-(--color-border) bg-(--color-surface) p-5 sm:p-6 shadow-2xl relative animate-in zoom-in-95 duration-150",
          maxWidthClasses[maxWidth] || "max-w-md",
          className
        )}
      >
        {(title || showCloseButton) && (
          <div className={clsx("flex items-start justify-between gap-3 mb-4", !title && "justify-end")}>
            {title && (
              <div>
                <h3 className="font-display text-lg font-bold text-(--color-text)">{title}</h3>
                {subtitle && <p className="text-xs text-(--color-text-muted) mt-0.5">{subtitle}</p>}
              </div>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-(--color-text-muted) hover:bg-(--color-surface-2) hover:text-(--color-text) transition-colors shrink-0"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
