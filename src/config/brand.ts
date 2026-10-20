/**
 * Single source of truth for brand identity. Every user-facing reference to
 * the platform name must read from here so a rename is a one-line change.
 */
export const brand = {
  name: "Texora",
  tagline: "Considered clothing, made to be worn.",
  description:
    "Texora is a modern specialty apparel house: tailored essentials, seasonal collections and fit families for every body.",
  locale: "en",
  /** Browser UI colour; mirrors --color-canvas (meta tags cannot read CSS variables). */
  themeColor: "#faf8f5",
  support: {
    phone: "(212) 555-0141",
    email: "care@texora.example",
    hours: "Monday to Friday 9am–8pm ET, weekends 10am–6pm ET",
  },
} as const;

/** Platform name for places that need a plain string. */
export const PLATFORM_NAME = brand.name;
