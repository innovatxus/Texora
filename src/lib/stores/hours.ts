import { LOCALE } from "@/config/locale";
import type { Store } from "@/lib/validation";

/** Day names, indexed like Date#getDay (0 = Sunday). */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** "20:00" → "8pm", "10:30" → "10:30am". */
export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/** Day of week (0 = Sunday) and minutes since midnight in the store's own time zone. */
export function localTime(now: Date, timeZone: string): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

const toMinutes = (hhmm: string) => {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export interface OpenStatus {
  open: boolean;
  label: string;
}

interface Range {
  open: string;
  close: string;
}

/** A one-off change for one local date (merchant locations; Texora stores have none). */
export interface SpecialHours {
  date: string;
  closed: boolean;
  open?: string | undefined;
  close?: string | undefined;
}

/**
 * Anything with weekly hours: Texora stores (one range a day) and merchant
 * locations (up to two ranges a day, plus special dates), D-066.
 */
export interface HoursSource {
  hours: ReadonlyArray<Range & { day: number }>;
  timezone: string;
  status?: Store["status"] | "active" | "archived";
  specialHours?: readonly SpecialHours[];
}

/** YYYY-MM-DD for a date `offset` days from now, in the given time zone. */
function localDate(now: Date, timeZone: string, offset = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now.getTime() + offset * 86_400_000));
}

/** Ranges for a day, honouring a special-hours entry for that date. */
function rangesFor(source: HoursSource, day: number, date: string): Range[] {
  const special = source.specialHours?.find((s) => s.date === date);
  if (special) {
    return special.closed || !special.open || !special.close
      ? []
      : [{ open: special.open, close: special.close }];
  }
  return source.hours
    .filter((h) => h.day === day)
    .map(({ open, close }) => ({ open, close }))
    .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
}

/** "Open until 8pm" / "Closed · opens 10am tomorrow", in the location's own time zone. */
export function openStatus(source: HoursSource, now: Date): OpenStatus {
  if (source.status === "closed") return { open: false, label: "Permanently closed" };
  if (source.status === "temporarily_closed") return { open: false, label: "Temporarily closed" };

  const { day, minutes } = localTime(now, source.timezone);
  const today = rangesFor(source, day, localDate(now, source.timezone));
  const current = today.find((r) => minutes >= toMinutes(r.open) && minutes < toMinutes(r.close));
  if (current) return { open: true, label: `Open until ${formatTime(current.close)}` };
  const laterToday = today.find((r) => minutes < toMinutes(r.open));
  if (laterToday) return { open: false, label: `Closed · opens ${formatTime(laterToday.open)}` };

  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDay = (day + offset) % 7;
    const [first] = rangesFor(source, nextDay, localDate(now, source.timezone, offset));
    if (first) {
      const when = offset === 1 ? "tomorrow" : (DAY_NAMES[nextDay] ?? "");
      return { open: false, label: `Closed · opens ${formatTime(first.open)} ${when}` };
    }
  }
  return { open: false, label: "Closed" };
}

/** Opening hours Monday-first for display, e.g. "10am – 1pm, 2pm – 6pm". */
export function weeklyHours(
  source: Pick<HoursSource, "hours">,
): Array<{ day: number; text: string }> {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => {
    const ranges = source.hours
      .filter((x) => x.day === day)
      .sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    return {
      day,
      text:
        ranges.length > 0
          ? ranges.map((h) => `${formatTime(h.open)} – ${formatTime(h.close)}`).join(", ")
          : "Closed",
    };
  });
}

/** Great-circle distance in miles. */
export function distanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}

/** A neutral directions link (OpenStreetMap); no maps key or third-party script needed. */
export function directionsUrl(store: Pick<Store, "geo">): string {
  const { lat, lng } = store.geo;
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=16/${lat}/${lng}`;
}
