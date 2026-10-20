"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDownIcon } from "@/components/icons";
import { OPEN_CONSENT_EVENT } from "@/lib/consent";

/** Ship-to selector. One market today; the structure is ready for more (i18n phase). */
export function CountrySelector() {
  return (
    <Popover.Root>
      <Popover.Trigger className="inline-flex items-center gap-2 text-sm text-ink underline-offset-4 hover:underline">
        <span className="text-ink-soft">Ship to:</span> United States (USD)
        <ChevronDownIcon size={20} className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-72 border border-line bg-surface p-5 text-sm shadow-overlay data-[state=open]:animate-menu-in"
        >
          <p className="font-medium">Shipping to the United States</p>
          <p className="mt-2 text-ink-soft">
            Prices are shown in US dollars. International shipping is coming soon.
          </p>
          <Popover.Arrow className="fill-surface" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Footer button that reopens the cookie preferences. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      Cookie settings
    </button>
  );
}
