"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Small line under the title */
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * iOS-style bottom sheet: slides up from the bottom, backdrop tap / Esc / close button /
 * swipe-down on the grabber dismisses it. Body scroll is locked while open.
 */
export function Sheet({ open, onClose, title, subtitle, children, className, testId }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- portal target exists only after mount
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      setDragY(0);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div
        className="absolute inset-0 bg-black/70 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        data-testid={testId}
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
        className={cn(
          "absolute inset-x-0 bottom-0 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[28px] border-t border-white/10 bg-popover outline-none",
          "animate-in slide-in-from-bottom duration-300 ease-out",
          className,
        )}
      >
        <div
          className="shrink-0 touch-none px-5 pt-2"
          onTouchStart={(e) => (startY.current = e.touches[0].clientY)}
          onTouchMove={(e) => {
            if (startY.current === null) return;
            setDragY(Math.max(0, e.touches[0].clientY - startY.current));
          }}
          onTouchEnd={() => {
            if (dragY > 90) onClose();
            setDragY(0);
            startY.current = null;
          }}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-white/20" />
          <div className="flex items-start gap-3 pb-3">
            <div className="min-w-0 flex-1 pt-1">
              {title && <h2 className="text-[19px] font-semibold leading-tight tracking-tight">{title}</h2>}
              {subtitle && <div className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 active:bg-white/20"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
