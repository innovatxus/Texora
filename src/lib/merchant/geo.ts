/**
 * US address helpers for merchant locations (D-068): states, the ZIP-code
 * ranges each state uses (to catch a ZIP that doesn't match its state), a
 * default timezone per state, and an approximate position (the state's
 * centre) used when no geocoding provider is configured. Pure and offline.
 */

export interface UsState {
  code: string;
  name: string;
  /** Inclusive 3-digit ZIP prefix ranges. */
  zip: ReadonlyArray<readonly [number, number]>;
  timezone: string;
  /** Approximate geographic centre. */
  centre: { lat: number; lng: number };
}

export const US_STATES: readonly UsState[] = [
  {
    code: "AL",
    name: "Alabama",
    zip: [[350, 369]],
    timezone: "America/Chicago",
    centre: { lat: 32.8, lng: -86.8 },
  },
  {
    code: "AK",
    name: "Alaska",
    zip: [[995, 999]],
    timezone: "America/Anchorage",
    centre: { lat: 61.4, lng: -152.3 },
  },
  {
    code: "AZ",
    name: "Arizona",
    zip: [[850, 865]],
    timezone: "America/Phoenix",
    centre: { lat: 34.2, lng: -111.7 },
  },
  {
    code: "AR",
    name: "Arkansas",
    zip: [[716, 729]],
    timezone: "America/Chicago",
    centre: { lat: 34.9, lng: -92.4 },
  },
  {
    code: "CA",
    name: "California",
    zip: [[900, 961]],
    timezone: "America/Los_Angeles",
    centre: { lat: 37.2, lng: -119.4 },
  },
  {
    code: "CO",
    name: "Colorado",
    zip: [[800, 816]],
    timezone: "America/Denver",
    centre: { lat: 39.0, lng: -105.5 },
  },
  {
    code: "CT",
    name: "Connecticut",
    zip: [[60, 69]],
    timezone: "America/New_York",
    centre: { lat: 41.6, lng: -72.7 },
  },
  {
    code: "DE",
    name: "Delaware",
    zip: [[197, 199]],
    timezone: "America/New_York",
    centre: { lat: 39.0, lng: -75.5 },
  },
  {
    code: "DC",
    name: "District of Columbia",
    zip: [[200, 205]],
    timezone: "America/New_York",
    centre: { lat: 38.9, lng: -77.0 },
  },
  {
    code: "FL",
    name: "Florida",
    zip: [[320, 349]],
    timezone: "America/New_York",
    centre: { lat: 28.6, lng: -82.4 },
  },
  {
    code: "GA",
    name: "Georgia",
    zip: [
      [300, 319],
      [398, 399],
    ],
    timezone: "America/New_York",
    centre: { lat: 32.7, lng: -83.4 },
  },
  {
    code: "HI",
    name: "Hawaii",
    zip: [[967, 968]],
    timezone: "Pacific/Honolulu",
    centre: { lat: 20.8, lng: -156.3 },
  },
  {
    code: "ID",
    name: "Idaho",
    zip: [[832, 838]],
    timezone: "America/Boise",
    centre: { lat: 44.4, lng: -114.6 },
  },
  {
    code: "IL",
    name: "Illinois",
    zip: [[600, 629]],
    timezone: "America/Chicago",
    centre: { lat: 40.0, lng: -89.2 },
  },
  {
    code: "IN",
    name: "Indiana",
    zip: [[460, 479]],
    timezone: "America/Indiana/Indianapolis",
    centre: { lat: 39.9, lng: -86.3 },
  },
  {
    code: "IA",
    name: "Iowa",
    zip: [[500, 528]],
    timezone: "America/Chicago",
    centre: { lat: 42.1, lng: -93.5 },
  },
  {
    code: "KS",
    name: "Kansas",
    zip: [[660, 679]],
    timezone: "America/Chicago",
    centre: { lat: 38.5, lng: -98.4 },
  },
  {
    code: "KY",
    name: "Kentucky",
    zip: [[400, 427]],
    timezone: "America/New_York",
    centre: { lat: 37.5, lng: -85.3 },
  },
  {
    code: "LA",
    name: "Louisiana",
    zip: [[700, 714]],
    timezone: "America/Chicago",
    centre: { lat: 31.1, lng: -92.0 },
  },
  {
    code: "ME",
    name: "Maine",
    zip: [[39, 49]],
    timezone: "America/New_York",
    centre: { lat: 45.4, lng: -69.2 },
  },
  {
    code: "MD",
    name: "Maryland",
    zip: [[206, 219]],
    timezone: "America/New_York",
    centre: { lat: 39.0, lng: -76.8 },
  },
  {
    code: "MA",
    name: "Massachusetts",
    zip: [
      [10, 27],
      [55, 55],
    ],
    timezone: "America/New_York",
    centre: { lat: 42.3, lng: -71.8 },
  },
  {
    code: "MI",
    name: "Michigan",
    zip: [[480, 499]],
    timezone: "America/Detroit",
    centre: { lat: 44.3, lng: -85.4 },
  },
  {
    code: "MN",
    name: "Minnesota",
    zip: [[550, 567]],
    timezone: "America/Chicago",
    centre: { lat: 46.3, lng: -94.3 },
  },
  {
    code: "MS",
    name: "Mississippi",
    zip: [[386, 397]],
    timezone: "America/Chicago",
    centre: { lat: 32.7, lng: -89.7 },
  },
  {
    code: "MO",
    name: "Missouri",
    zip: [[630, 658]],
    timezone: "America/Chicago",
    centre: { lat: 38.4, lng: -92.5 },
  },
  {
    code: "MT",
    name: "Montana",
    zip: [[590, 599]],
    timezone: "America/Denver",
    centre: { lat: 47.0, lng: -109.6 },
  },
  {
    code: "NE",
    name: "Nebraska",
    zip: [[680, 693]],
    timezone: "America/Chicago",
    centre: { lat: 41.5, lng: -99.8 },
  },
  {
    code: "NV",
    name: "Nevada",
    zip: [[889, 898]],
    timezone: "America/Los_Angeles",
    centre: { lat: 39.3, lng: -116.6 },
  },
  {
    code: "NH",
    name: "New Hampshire",
    zip: [[30, 38]],
    timezone: "America/New_York",
    centre: { lat: 43.7, lng: -71.6 },
  },
  {
    code: "NJ",
    name: "New Jersey",
    zip: [[70, 89]],
    timezone: "America/New_York",
    centre: { lat: 40.2, lng: -74.7 },
  },
  {
    code: "NM",
    name: "New Mexico",
    zip: [[870, 884]],
    timezone: "America/Denver",
    centre: { lat: 34.4, lng: -106.1 },
  },
  {
    code: "NY",
    name: "New York",
    zip: [
      [5, 5],
      [100, 149],
    ],
    timezone: "America/New_York",
    centre: { lat: 42.9, lng: -75.5 },
  },
  {
    code: "NC",
    name: "North Carolina",
    zip: [[270, 289]],
    timezone: "America/New_York",
    centre: { lat: 35.6, lng: -79.4 },
  },
  {
    code: "ND",
    name: "North Dakota",
    zip: [[580, 588]],
    timezone: "America/Chicago",
    centre: { lat: 47.5, lng: -100.5 },
  },
  {
    code: "OH",
    name: "Ohio",
    zip: [[430, 459]],
    timezone: "America/New_York",
    centre: { lat: 40.3, lng: -82.8 },
  },
  {
    code: "OK",
    name: "Oklahoma",
    zip: [[730, 749]],
    timezone: "America/Chicago",
    centre: { lat: 35.6, lng: -97.5 },
  },
  {
    code: "OR",
    name: "Oregon",
    zip: [[970, 979]],
    timezone: "America/Los_Angeles",
    centre: { lat: 43.9, lng: -120.6 },
  },
  {
    code: "PA",
    name: "Pennsylvania",
    zip: [[150, 196]],
    timezone: "America/New_York",
    centre: { lat: 40.9, lng: -77.8 },
  },
  {
    code: "RI",
    name: "Rhode Island",
    zip: [[28, 29]],
    timezone: "America/New_York",
    centre: { lat: 41.7, lng: -71.5 },
  },
  {
    code: "SC",
    name: "South Carolina",
    zip: [[290, 299]],
    timezone: "America/New_York",
    centre: { lat: 33.9, lng: -80.9 },
  },
  {
    code: "SD",
    name: "South Dakota",
    zip: [[570, 577]],
    timezone: "America/Chicago",
    centre: { lat: 44.4, lng: -100.2 },
  },
  {
    code: "TN",
    name: "Tennessee",
    zip: [[370, 385]],
    timezone: "America/Chicago",
    centre: { lat: 35.9, lng: -86.4 },
  },
  {
    code: "TX",
    name: "Texas",
    zip: [
      [750, 799],
      [885, 885],
    ],
    timezone: "America/Chicago",
    centre: { lat: 31.5, lng: -99.3 },
  },
  {
    code: "UT",
    name: "Utah",
    zip: [[840, 847]],
    timezone: "America/Denver",
    centre: { lat: 39.3, lng: -111.7 },
  },
  {
    code: "VT",
    name: "Vermont",
    zip: [
      [50, 54],
      [56, 59],
    ],
    timezone: "America/New_York",
    centre: { lat: 44.1, lng: -72.7 },
  },
  {
    code: "VA",
    name: "Virginia",
    zip: [
      [201, 201],
      [220, 246],
    ],
    timezone: "America/New_York",
    centre: { lat: 37.5, lng: -78.9 },
  },
  {
    code: "WA",
    name: "Washington",
    zip: [[980, 994]],
    timezone: "America/Los_Angeles",
    centre: { lat: 47.4, lng: -120.5 },
  },
  {
    code: "WV",
    name: "West Virginia",
    zip: [[247, 268]],
    timezone: "America/New_York",
    centre: { lat: 38.6, lng: -80.6 },
  },
  {
    code: "WI",
    name: "Wisconsin",
    zip: [[530, 549]],
    timezone: "America/Chicago",
    centre: { lat: 44.6, lng: -89.9 },
  },
  {
    code: "WY",
    name: "Wyoming",
    zip: [[820, 831]],
    timezone: "America/Denver",
    centre: { lat: 43.0, lng: -107.6 },
  },
];

const BY_CODE = new Map(US_STATES.map((s) => [s.code, s]));

/** The state for a two-letter code. */
export function usState(code: string): UsState | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/** Whether a 5-digit ZIP belongs to the state (by its 3-digit prefix). */
export function zipMatchesState(zip: string, stateCode: string): boolean {
  const state = usState(stateCode);
  const prefix = Number(zip.trim().slice(0, 3));
  if (!state || !/^\d{5}/.test(zip.trim())) return false;
  return state.zip.some(([from, to]) => prefix >= from && prefix <= to);
}

/** Timezones a merchant can pick for a location. */
export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Detroit", label: "Eastern (Michigan)" },
  { value: "America/Indiana/Indianapolis", label: "Eastern (Indiana)" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Boise", label: "Mountain (Idaho)" },
  { value: "America/Phoenix", label: "Mountain, no daylight saving (Arizona)" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
] as const;

export interface GeocodeResult {
  /** Approximate position; present only when known. */
  geo?: { lat: number; lng: number };
  timezone: string;
  /** "state" when the position is the state's centre (no provider configured). */
  precision: "address" | "state";
}

/**
 * Offline geocoding fallback: the state's default timezone and centre. A
 * provider-backed geocoder (production) returns street-level positions
 * behind the same shape.
 */
export function geocodeByState(stateCode: string): GeocodeResult | null {
  const state = usState(stateCode);
  return state ? { geo: state.centre, timezone: state.timezone, precision: "state" } : null;
}
