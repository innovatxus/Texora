import type { ComponentProps } from "react";
import { cva } from "class-variance-authority";
import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils/cn";

export const chipVariants = cva(
  [
    "inline-flex h-9 items-center gap-1.5 rounded-chip border px-3 text-sm whitespace-nowrap",
    "transition-colors duration-fast ease-atelier",
    "disabled:cursor-not-allowed disabled:text-ink-subtle",
  ],
  {
    variants: {
      selected: {
        true: "border-ink bg-ink text-surface",
        false: "border-transparent bg-surface-muted text-ink not-disabled:hover:border-ink-subtle",
      },
    },
    defaultVariants: { selected: false },
  },
);

interface ChipBaseProps extends Omit<ComponentProps<"button">, "children" | "aria-pressed"> {
  label: string;
}

export interface ToggleChipProps extends ChipBaseProps {
  variant?: "toggle";
  /** Pressed state, announced via aria-pressed. */
  selected: boolean;
}

export interface DismissibleChipProps extends ChipBaseProps {
  variant: "dismissible";
  /** Accessible name for the remove action. Defaults to "Remove {label}". */
  removeLabel?: string;
}

export type ChipProps = ToggleChipProps | DismissibleChipProps;

/**
 * Toggle chips filter or choose (aria-pressed). Dismissible chips show an
 * active filter and remove it on click.
 */
export function Chip(props: ChipProps) {
  if (props.variant === "dismissible") {
    const { variant: _variant, label, removeLabel, className, type = "button", ...rest } = props;
    return (
      <button
        type={type}
        aria-label={removeLabel ?? `Remove ${label}`}
        className={cn(chipVariants({ selected: false }), "pr-2", className)}
        {...rest}
      >
        <span>{label}</span>
        <CloseIcon size={20} className="size-4" />
      </button>
    );
  }

  const { variant: _variant, label, selected, className, type = "button", ...rest } = props;
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(chipVariants({ selected }), className)}
      {...rest}
    >
      {label}
    </button>
  );
}
