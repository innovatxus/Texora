/**
 * Location helpers for merchant shops in Egypt: every governorate with its
 * capital's position (an offline geocoding fallback for maps and distance),
 * and the single national time zone. Pure, so it is unit tested.
 */
import { GOVERNORATES, TIME_ZONE } from "@/config/locale";

/** Each governorate's capital: an approximate centre until a geocoder gives street level. */
const CENTRES: Record<string, { lat: number; lng: number }> = {
  C: { lat: 30.0444, lng: 31.2357 },
  GZ: { lat: 30.0131, lng: 31.2089 },
  ALX: { lat: 31.2001, lng: 29.9187 },
  KB: { lat: 30.466, lng: 31.1858 },
  DK: { lat: 31.0409, lng: 31.3785 },
  SHR: { lat: 30.5877, lng: 31.502 },
  GH: { lat: 30.7865, lng: 31.0004 },
  MNF: { lat: 30.5526, lng: 31.0122 },
  BH: { lat: 31.0341, lng: 30.4682 },
  KFS: { lat: 31.1107, lng: 30.9388 },
  DT: { lat: 31.4165, lng: 31.8133 },
  PTS: { lat: 31.2653, lng: 32.3019 },
  IS: { lat: 30.5965, lng: 32.2715 },
  SUZ: { lat: 29.9668, lng: 32.5498 },
  FYM: { lat: 29.3084, lng: 30.8428 },
  BNS: { lat: 29.0661, lng: 31.0994 },
  MN: { lat: 28.1099, lng: 30.7503 },
  AST: { lat: 27.1783, lng: 31.1859 },
  SHG: { lat: 26.5591, lng: 31.6948 },
  KN: { lat: 26.1551, lng: 32.716 },
  LX: { lat: 25.6872, lng: 32.6396 },
  ASN: { lat: 24.0889, lng: 32.8998 },
  BA: { lat: 27.2579, lng: 33.8116 },
  WAD: { lat: 25.439, lng: 30.5586 },
  MT: { lat: 31.3543, lng: 27.2373 },
  SIN: { lat: 31.1316, lng: 33.7984 },
  JS: { lat: 28.2417, lng: 33.6222 },
};

/** Governorates a merchant can choose for a location. */
export const GOVERNORATE_OPTIONS = GOVERNORATES.map((g) => ({ value: g.code, label: g.name }));

export interface GeocodeResult {
  /** Approximate position; present only when known. */
  geo?: { lat: number; lng: number };
  timezone: string;
  /** "governorate" when the position is the governorate's capital (no provider configured). */
  precision: "address" | "governorate";
}

/**
 * Offline geocoding fallback: the governorate capital's position and Egypt's
 * time zone. A provider-backed geocoder returns street-level positions behind
 * the same shape.
 */
export function geocodeByGovernorate(code: string): GeocodeResult | null {
  const centre = CENTRES[code];
  return centre ? { geo: centre, timezone: TIME_ZONE, precision: "governorate" } : null;
}
