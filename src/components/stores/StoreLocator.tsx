"use client";

import { LOCALE, cityLine, governorateName } from "@/config/locale";
import NextLink from "next/link";
import { useId, useState } from "react";
import { StoreIcon } from "@/components/icons";
import { Button, Chip, Input, Link } from "@/components/primitives";
import { SERVICE_ORDER, STORE_SERVICES } from "@/config/store-services";
import { directionsUrl, distanceMiles } from "@/lib/stores/hours";
import type { Store } from "@/lib/validation";
import { StoreOpenStatus } from "./StoreOpenStatus";

type Service = Store["services"][number];
type Position = { lat: number; lng: number };

const matches = (store: Store, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { city, region, postalCode, line1 } = store.address;
  return [store.name, city, governorateName(region), postalCode, line1].some((v) =>
    (v ?? "").toLowerCase().includes(q),
  );
};

/**
 * Store list with text search, service filters and "near me" sorting from
 * the browser's location (asked for only when the visitor presses the
 * button; nothing leaves the device).
 */
export function StoreLocator({ stores }: { stores: Store[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState<"idle" | "pending" | "denied" | "unavailable">("idle");

  const results = stores
    .filter((s) => matches(s, query))
    .filter((s) => services.every((service) => s.services.includes(service)))
    .map((s) => ({ store: s, miles: position ? distanceMiles(position, s.geo) : null }))
    .sort((a, b) =>
      a.miles !== null && b.miles !== null
        ? a.miles - b.miles
        : a.store.name.localeCompare(b.store.name),
    );

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setLocating("unavailable");
      return;
    }
    setLocating("pending");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating("idle");
      },
      (error) => setLocating(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    );
  };

  const toggle = (service: Service) =>
    setServices((current) =>
      current.includes(service) ? current.filter((s) => s !== service) : [...current, service],
    );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Input
          id={`${id}-search`}
          type="search"
          label="City, state or ZIP code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm sm:flex-1"
        />
        <Button variant="secondary" onClick={locate} loading={locating === "pending"}>
          Use my location
        </Button>
      </div>
      {locating === "denied" && (
        <p className="text-sm text-ink-soft">
          Location access is turned off. Search by city or ZIP code instead.
        </p>
      )}
      {locating === "unavailable" && (
        <p className="text-sm text-ink-soft">
          We couldn&apos;t find your location. Search by city or ZIP code instead.
        </p>
      )}

      <div role="group" aria-label="Filter by service" className="flex flex-wrap gap-2">
        {SERVICE_ORDER.map((service) => (
          <Chip
            key={service}
            label={STORE_SERVICES[service].label}
            selected={services.includes(service)}
            onClick={() => toggle(service)}
          />
        ))}
      </div>

      <p aria-live="polite" className="text-sm text-ink-soft">
        {results.length === 0
          ? "No stores match. Try a different search or fewer filters."
          : `${results.length} ${results.length === 1 ? "store" : "stores"}${position ? ", nearest first" : ""}`}
      </p>

      <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {results.map(({ store, miles }) => (
          <li key={store.id} className="flex flex-col gap-3 border border-line bg-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="flex items-center gap-2 font-display text-2xl">
                <StoreIcon /> {store.name}
              </h2>
              {miles !== null && (
                <span className="shrink-0 text-sm text-ink-soft tabular-nums">
                  {miles < 10 ? miles.toFixed(1) : Math.round(miles).toLocaleString(LOCALE)} mi
                </span>
              )}
            </div>
            <address className="text-sm text-ink-soft not-italic">
              {store.address.line1}
              <br />
              {cityLine(store.address)}
            </address>
            <StoreOpenStatus store={store} />
            <p className="text-sm text-ink-soft">
              {store.services.map((s) => STORE_SERVICES[s].label).join(" · ")}
            </p>
            <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm">
              <NextLink
                href={`/stores/${store.slug}`}
                className="font-medium underline underline-offset-4"
              >
                Store details<span className="sr-only">: {store.name}</span>
              </NextLink>
              <Link href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}>{store.phone}</Link>
              <Link href={directionsUrl(store)} target="_blank" rel="noopener noreferrer">
                Directions<span className="sr-only"> to {store.name} (opens in a new tab)</span>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
