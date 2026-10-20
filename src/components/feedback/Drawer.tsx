"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { CloseIcon } from "@/components/icons";
import { IconButton, VisuallyHidden } from "@/components/primitives";
import { cn } from "@/lib/utils/cn";

const panelVariants = cva(
  "fixed z-50 flex flex-col bg-surface shadow-overlay outline-none focus-visible:outline-none",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-dvh w-full max-w-md data-[state=closed]:animate-drawer-out-right data-[state=open]:animate-drawer-in-right",
        left: "inset-y-0 left-0 h-dvh w-full max-w-sm data-[state=closed]:animate-drawer-out-left data-[state=open]:animate-drawer-in-left",
        top: "inset-x-0 top-0 max-h-dvh w-full data-[state=closed]:animate-sheet-out-top data-[state=open]:animate-sheet-in-top",
      },
    },
    defaultVariants: { side: "right" },
  },
);

export interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Hide the visible header (the title stays available to screen readers). */
  hideHeader?: boolean;
  description?: string;
  side?: "left" | "right" | "top";
  children: ReactNode;
  className?: string;
  /** Element focused on open; defaults to the first focusable element. */
  initialFocus?: () => HTMLElement | null;
}

/**
 * Slide-in panel with focus trap, Escape / scrim close, and focus returned to
 * the trigger. 300ms slide; reduced motion fades instead.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  hideHeader = false,
  description,
  side = "right",
  children,
  className,
  initialFocus,
}: DrawerProps) {
  // Panels are opened from anywhere (store-driven), not only Dialog.Trigger,
  // so remember what had focus and restore it on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(panelVariants({ side }), className)}
          onOpenAutoFocus={(event) => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            const target = initialFocus?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          {hideHeader ? (
            <VisuallyHidden>
              <Dialog.Title>{title}</Dialog.Title>
            </VisuallyHidden>
          ) : (
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 md:px-6">
              <Dialog.Title className="text-label">{title}</Dialog.Title>
              <Dialog.Close asChild>
                <IconButton label="Close" icon={<CloseIcon />} className="-mr-2" />
              </Dialog.Close>
            </div>
          )}
          {description && (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Wraps any element so activating it closes the drawer. */
export const DrawerClose = Dialog.Close;
