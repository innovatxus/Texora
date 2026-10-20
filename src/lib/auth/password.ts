/**
 * Password policy for merchant (and, later, customer) accounts: at least 12
 * characters, not a common password, and a zxcvbn-style strength score of at
 * least 3 out of 4. No composition rules. Pure and dependency-free, so the
 * browser meter and the Server Action give the same answer.
 */
import { MERCHANT_LIMITS } from "@/config/merchant";
import { COMMON_PASSWORDS } from "./common-passwords";

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export const PASSWORD_MAX_LENGTH = 128;

/** Meter labels by score; 0 and 1 share "Too weak". */
export const PASSWORD_SCORE_LABELS: Readonly<Record<PasswordScore, string>> = {
  0: "Too weak",
  1: "Too weak",
  2: "Weak",
  3: "Good",
  4: "Strong",
};

const LEET: Readonly<Record<string, string>> = {
  "@": "a",
  "4": "a",
  "8": "b",
  "(": "c",
  "3": "e",
  "6": "g",
  "1": "i",
  "!": "i",
  "|": "l",
  "0": "o",
  $: "s",
  "5": "s",
  "7": "t",
  "+": "t",
  "2": "z",
};

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";

/** Lower-cases and undoes common letter substitutions: "P@ssw0rd" → "password". */
function normalise(value: string): string {
  return [...value.toLowerCase()].map((c) => LEET[c] ?? c).join("");
}

/** Size of the character set the password draws from. */
function poolSize(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^a-zA-Z\d\s]/.test(password)) pool += 33;
  if (/\s/.test(password)) pool += 1;
  if (/[^\x00-\x7f]/.test(password)) pool += 100;
  return Math.max(pool, 10);
}

interface Span {
  start: number;
  end: number;
  /** log10 of the guesses an attacker needs for this part. */
  cost: number;
}

/** Ascending or descending runs of 3+ letters or digits ("abc", "987"). */
function sequenceSpans(lower: string): Span[] {
  const spans: Span[] = [];
  for (const alphabet of [ALPHABET, DIGITS]) {
    let i = 0;
    while (i < lower.length - 2) {
      const a = alphabet.indexOf(lower[i] ?? "");
      const b = alphabet.indexOf(lower[i + 1] ?? "");
      const step = b - a;
      if (a === -1 || b === -1 || Math.abs(step) !== 1) {
        i++;
        continue;
      }
      let j = i + 1;
      while (
        j + 1 < lower.length &&
        alphabet.indexOf(lower[j + 1] ?? "") - alphabet.indexOf(lower[j] ?? "") === step
      ) {
        j++;
      }
      if (j - i + 1 >= 3) spans.push({ start: i, end: j + 1, cost: Math.log10((j - i + 1) * 4) });
      i = j + 1;
    }
  }
  return spans;
}

/** Adjacent keys of 4+ ("qwer", "asdfg"), forwards or backwards. */
function keyboardSpans(lower: string): Span[] {
  const spans: Span[] = [];
  for (const row of KEYBOARD_ROWS) {
    for (const line of [row, [...row].reverse().join("")]) {
      for (let len = line.length; len >= 4; len--) {
        for (let k = 0; k + len <= line.length; k++) {
          const piece = line.slice(k, k + len);
          let from = lower.indexOf(piece);
          while (from !== -1) {
            spans.push({ start: from, end: from + len, cost: Math.log10(len * 30) });
            from = lower.indexOf(piece, from + 1);
          }
        }
      }
    }
  }
  return spans;
}

/** Repeated characters or chunks ("aaaa", "abcabc"). */
function repeatSpans(lower: string, pool: number): Span[] {
  const spans: Span[] = [];
  const re = /(.+?)\1+/g;
  for (const match of lower.matchAll(re)) {
    const [whole, unit] = match;
    if (!unit || whole.length < 3) continue;
    const start = match.index;
    const times = whole.length / unit.length;
    spans.push({
      start,
      end: start + whole.length,
      cost: unit.length * Math.log10(pool) + Math.log10(times),
    });
  }
  return spans;
}

/** Digit runs (cheap: 10 options each), years 1900–2099, and symbol runs. */
function classSpans(password: string): Span[] {
  const spans: Span[] = [];
  for (const match of password.matchAll(/\d+/g)) {
    spans.push({ start: match.index, end: match.index + match[0].length, cost: match[0].length });
  }
  for (const match of password.matchAll(/(?:19|20)\d\d/g)) {
    spans.push({ start: match.index, end: match.index + 4, cost: Math.log10(200) });
  }
  for (const match of password.matchAll(/[^a-zA-Z\d\s]+/g)) {
    spans.push({
      start: match.index,
      end: match.index + match[0].length,
      cost: match[0].length * Math.log10(33),
    });
  }
  return spans;
}

/** Common passwords and personal words (email, username) anywhere in the password. */
function dictionarySpans(normalised: string, words: readonly string[], cost: number): Span[] {
  const spans: Span[] = [];
  for (const word of words) {
    if (word.length < 3) continue;
    let from = normalised.indexOf(word);
    while (from !== -1) {
      spans.push({ start: from, end: from + word.length, cost });
      from = normalised.indexOf(word, from + 1);
    }
  }
  return spans;
}

/** Personal words to penalise: the email's local part and domain name, the username, pieces of each. */
function personalWords(inputs: readonly string[]): string[] {
  const words = new Set<string>();
  for (const input of inputs) {
    // Split before normalising: "@" would otherwise become "a".
    const lower = input.trim().toLowerCase();
    if (!lower) continue;
    const [local = "", domain = ""] = lower.split("@");
    for (const part of [local, domain.split(".")[0] ?? "", ...lower.split(/[^a-z0-9]+/)]) {
      if (part.length >= 3) words.add(normalise(part));
    }
  }
  return [...words];
}

/**
 * Estimates guesses as log10: the cheapest way to cover the password with
 * known patterns, plus a full character-set guess for every uncovered
 * character. Dynamic programming over positions picks the cheapest cover.
 */
export function passwordGuessesLog10(password: string, userInputs: readonly string[] = []): number {
  if (!password) return 0;
  const lower = password.toLowerCase();
  const normalised = normalise(password);
  const pool = poolSize(password);
  const perChar = Math.log10(pool);
  const common = [...COMMON_PASSWORDS].filter((w) => w.length >= 4);

  const spans = [
    ...dictionarySpans(normalised, common, 2.5),
    ...dictionarySpans(lower, common, 2.5),
    ...dictionarySpans(normalised, personalWords(userInputs), 1),
    ...sequenceSpans(lower),
    ...keyboardSpans(lower),
    ...repeatSpans(lower, pool),
    ...classSpans(password),
  ];

  // best[i] = cheapest log10-guesses to cover password[0..i); patterns add ~1 per extra piece.
  const best = new Array<number>(password.length + 1).fill(Number.POSITIVE_INFINITY);
  best[0] = 0;
  for (let i = 0; i < password.length; i++) {
    const here = best[i] ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(here)) continue;
    best[i + 1] = Math.min(best[i + 1] ?? Infinity, here + perChar);
    for (const span of spans) {
      if (span.start !== i) continue;
      const joined = here === 0 ? span.cost : here + span.cost + 0.3;
      best[span.end] = Math.min(best[span.end] ?? Infinity, joined);
    }
  }
  return best[password.length] ?? 0;
}

/** 0–4, like zxcvbn: 3 means "safely unguessable" for an online attack with rate limits. */
export function passwordScore(password: string, userInputs: readonly string[] = []): PasswordScore {
  const guesses = passwordGuessesLog10(password, userInputs);
  if (guesses < 3) return 0;
  if (guesses < 6) return 1;
  if (guesses < 8) return 2;
  if (guesses < 10) return 3;
  return 4;
}

/** Whether a password is a common one, ignoring case, substitutions and trailing digits/symbols. */
export function isCommonPassword(password: string): boolean {
  const lower = password.toLowerCase();
  const stem = lower.replace(/[\d\W_]+$/u, "");
  return [lower, normalise(password), stem, normalise(stem)].some((p) => COMMON_PASSWORDS.has(p));
}

/**
 * The first problem with a password in shopper-facing words, or null when it
 * meets the policy. `userInputs` are the email and username, which shouldn't
 * make up the password.
 */
export function passwordProblem(
  password: string,
  userInputs: readonly string[] = [],
): string | null {
  const { minLength, minScore } = MERCHANT_LIMITS.password;
  if (password.length < minLength) return `Use at least ${minLength} characters`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `Use ${PASSWORD_MAX_LENGTH} characters or fewer`;
  if (isCommonPassword(password)) {
    return "That password is too common — try a phrase only you would use";
  }
  if (passwordScore(password, userInputs) < minScore) {
    return "Add a few more words or characters to make it stronger";
  }
  return null;
}
