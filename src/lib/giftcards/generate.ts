import "server-only";
import { randomInt } from "node:crypto";

/** No 0/O or 1/I, so codes read back reliably from paper or a screen. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** TXGC-XXXX-XXXX-XXXX: 12 random characters, about 60 bits. */
export function generateGiftCardCode(): string {
  const groups = Array.from({ length: 3 }, () =>
    Array.from({ length: 4 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join(""),
  );
  return `TXGC-${groups.join("-")}`;
}
