"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/icons";
import { IconButton } from "@/components/primitives";
import { cn } from "@/lib/utils/cn";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional media column shown beside the content from md up. */
  aside?: ReactNode;
  className?: string;
}

/** Centred dialog: focus trap, Escape and scrim to close, focus returns to the trigger. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  aside,
  className,
}: ModalProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-surface shadow-overlay",
            "data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in",
            aside && "max-w-3xl md:grid-cols-2",
            className,
          )}
          onOpenAutoFocus={() => {
            returnFocus.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          {aside && <div className="hidden md:block">{aside}</div>}
          <div className="relative p-6 md:p-10">
            <Dialog.Close asChild>
              <IconButton label="Close" icon={<CloseIcon />} className="absolute top-2 right-2" />
            </Dialog.Close>
            <Dialog.Title className="pr-8 font-display text-3xl">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="mt-3 text-ink-soft">{description}</Dialog.Description>
            )}
            <div className="mt-6">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
