"use client";

import { governorateName } from "@/config/locale";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/merchant/forms/ErrorSummary";
import { Badge, Button, ButtonLink } from "@/components/primitives";
import { LOCATION_TYPES } from "@/config/merchant";
import { saveLocationAction, updateLocationAction } from "@/lib/merchant/actions/shop";
import type { MerchantLocation } from "@/lib/validation/merchant";
import type { FormMode } from "@/components/merchant/forms/StepFooter";
import { LocationForm } from "./LocationForm";

const REVIEW_PATH = "/merchant/onboarding/review";
const TYPE_LABELS = Object.fromEntries(LOCATION_TYPES.map((t) => [t.value, t.label]));

/**
 * Onboarding step 4 / Shop › Locations: add, edit, reorder, set primary and
 * archive (never delete; stock may reference a location). At least one
 * active location must ship.
 */
export function LocationsManager({
  mode,
  shopId,
  locations,
}: {
  mode: FormMode;
  shopId: string;
  locations: readonly MerchantLocation[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(
    locations.length === 0 ? "new" : null,
  );
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const shipFrom = locations.filter((l) => l.types.includes("ship_from")).length;

  const run = (
    locationId: string,
    operation: "archive" | "primary" | "up" | "down",
    done: string,
  ) =>
    startTransition(async () => {
      const result = await updateLocationAction({ shopId, locationId, operation });
      setMessage(
        result.ok ? { tone: "success", text: done } : { tone: "error", text: result.error.message },
      );
      if (result.ok) router.refresh();
    });

  const finish = (text: string) => {
    setEditing(null);
    setMessage({ tone: "success", text });
    router.refresh();
  };

  // During onboarding, a location that ships completes the step: go on to review.
  const added = (types: readonly string[]) => {
    if (mode === "onboarding" && types.includes("ship_from")) {
      router.push(REVIEW_PATH);
      return;
    }
    finish(
      types.includes("ship_from") || shipFrom > 0
        ? "Location added."
        : "Location added. Orders still need a place to ship from: choose “Ship orders from here” below.",
    );
  };

  // Texora is delivery only, so a shop needs a location that ships orders.
  const shipFromHere = (location: MerchantLocation) =>
    startTransition(async () => {
      const result = await saveLocationAction({
        shopId,
        locationId: location.id,
        name: location.name,
        types: [...location.types, "ship_from"],
        address: {
          line1: location.address.line1,
          line2: location.address.line2,
          city: location.address.city,
          region: location.address.region,
          postalCode: location.address.postalCode ?? "",
        },
        timezone: location.timezone,
        hours: [],
        specialHours: [],
        phone: location.phone ?? "",
      });
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error.message });
        return;
      }
      if (mode === "onboarding") {
        router.push(REVIEW_PATH);
        return;
      }
      setMessage({ tone: "success", text: `Orders now ship from ${location.name}.` });
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      {locations.length === 0 && editing !== "new" && (
        <p className="text-ink-soft">
          Add where you ship from. Shoppers see retail stores on your shop page.
        </p>
      )}
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

      <ol className="flex flex-col gap-4">
        {locations.map((location, index) =>
          editing === location.id ? (
            <li key={location.id}>
              <LocationForm
                shopId={shopId}
                location={location}
                onDone={() => finish(`${location.name} saved.`)}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li
              key={location.id}
              className="flex flex-col gap-3 border border-line bg-surface p-4 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 text-lg font-medium">
                    {location.name}
                    {location.isPrimary && <Badge>Primary</Badge>}
                  </h3>
                  <p className="text-sm text-ink-soft">
                    {location.types.map((t) => TYPE_LABELS[t]).join(" · ")} ·{" "}
                    {location.address.city}, {governorateName(location.address.region)}
                  </p>
                </div>
              </div>
              {shipFrom === 0 && (
                <div className="flex flex-wrap items-center gap-3 bg-surface-muted p-3 text-sm">
                  <span>Orders need a place to ship from. Do they ship from here?</span>
                  <Button type="button" disabled={pending} onClick={() => shipFromHere(location)}>
                    Ship orders from here
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <button
                  type="button"
                  className="min-h-11 underline underline-offset-4"
                  onClick={() => setEditing(location.id)}
                >
                  Edit<span className="sr-only"> {location.name}</span>
                </button>
                <button
                  type="button"
                  disabled={pending || index === 0}
                  className="min-h-11 underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
                  onClick={() => run(location.id, "up", `${location.name} moved up.`)}
                >
                  Move up<span className="sr-only"> {location.name}</span>
                </button>
                <button
                  type="button"
                  disabled={pending || index === locations.length - 1}
                  className="min-h-11 underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
                  onClick={() => run(location.id, "down", `${location.name} moved down.`)}
                >
                  Move down<span className="sr-only"> {location.name}</span>
                </button>
                {!location.isPrimary && (
                  <button
                    type="button"
                    disabled={pending}
                    className="min-h-11 underline underline-offset-4"
                    onClick={() =>
                      run(location.id, "primary", `${location.name} is now your primary location.`)
                    }
                  >
                    Set as primary<span className="sr-only"> ({location.name})</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending || (location.types.includes("ship_from") && shipFrom === 1)}
                  className="min-h-11 text-sale underline underline-offset-4 disabled:text-ink-subtle disabled:no-underline"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Archive ${location.name}? Its stock stays on your products but it won't be used for shipping.`,
                      )
                    ) {
                      run(location.id, "archive", `${location.name} archived.`);
                    }
                  }}
                >
                  Archive<span className="sr-only"> {location.name}</span>
                </button>
              </div>
            </li>
          ),
        )}
      </ol>

      {editing === "new" ? (
        <LocationForm shopId={shopId} onDone={added} onCancel={() => setEditing(null)} />
      ) : locations.length === 0 ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setEditing("new")}
        >
          Add a location
        </Button>
      ) : (
        <button
          type="button"
          className="min-h-11 self-start text-sm underline underline-offset-4"
          onClick={() => setEditing("new")}
        >
          Add another location
        </button>
      )}

      {mode === "onboarding" && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <ButtonLink href="/merchant/onboarding/contact" variant="tertiary">
            Back
          </ButtonLink>
          {shipFrom > 0 ? (
            <ButtonLink href={REVIEW_PATH}>Continue to review</ButtonLink>
          ) : (
            <p className="text-sm text-ink-soft">
              {locations.length > 0
                ? "Choose a location orders ship from to continue."
                : "Add a location orders ship from to continue."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
