import type { FaqEntry } from "@/config/help";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "can",
  "do",
  "does",
  "for",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "the",
  "to",
  "what",
  "when",
  "where",
  "will",
  "you",
]);

/** Lower-case words without punctuation or stop words; a trailing "s" is dropped so plurals match. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

/**
 * Ranks FAQ entries for a query. Every query word must appear (as a word
 * prefix) somewhere in the entry; matches in the question count three
 * times as much as matches in the answer.
 */
export function searchFaq(entries: readonly FaqEntry[], query: string): FaqEntry[] {
  const words = tokenize(query);
  if (words.length === 0) return [];
  return entries
    .map((entry) => {
      const question = tokenize(entry.question);
      const answer = tokenize(`${entry.answer} ${entry.category}`);
      let score = 0;
      for (const word of words) {
        const inQuestion = question.filter((w) => w.startsWith(word)).length;
        const inAnswer = answer.filter((w) => w.startsWith(word)).length;
        if (inQuestion + inAnswer === 0) return { entry, score: 0 };
        score += inQuestion * 3 + inAnswer;
      }
      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.entry);
}
