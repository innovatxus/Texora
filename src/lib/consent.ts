import { notifyBrowserStateChanged } from "./browser/storage";

/** Cookie consent: necessary is always on; analytics and marketing need opt-in. */
export const CONSENT_COOKIE = "tx_consent";
/** Cookie choices are remembered for 180 days. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
/** Bump to ask everyone for consent again after the policy changes. */
export const CONSENT_VERSION = 1;

export interface ConsentChoices {
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentRecord extends ConsentChoices {
  version: number;
  decidedAt: number;
}

/** Reads a consent cookie value; null if missing, malformed or from an older version. */
export function parseConsent(value: string | undefined | null): ConsentRecord | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (
      parsed &&
      typeof parsed === "object" &&
      "version" in parsed &&
      parsed.version === CONSENT_VERSION &&
      "analytics" in parsed &&
      typeof parsed.analytics === "boolean" &&
      "marketing" in parsed &&
      typeof parsed.marketing === "boolean" &&
      "decidedAt" in parsed &&
      typeof parsed.decidedAt === "number"
    ) {
      return {
        version: CONSENT_VERSION,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
        decidedAt: parsed.decidedAt,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Encodes cookie choices for the consent cookie. */
export function serializeConsent(choices: ConsentChoices, now = Date.now()): string {
  return encodeURIComponent(
    JSON.stringify({ version: CONSENT_VERSION, ...choices, decidedAt: now }),
  );
}

/** Reads consent from a raw Cookie header (server side). */
export function readConsentCookie(cookieHeader: string): ConsentRecord | null {
  const match = cookieHeader.split(/;\s*/).find((part) => part.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}

/** Browser-only: persist the choice and notify listeners (analytics loaders). */
export function writeConsent(choices: ConsentChoices): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choices)}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("texora:consent-changed", { detail: choices }));
  notifyBrowserStateChanged();
}

/** Window event that reopens the cookie preferences. */
export const OPEN_CONSENT_EVENT = "texora:open-consent";
