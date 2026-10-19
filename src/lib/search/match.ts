/**
 * In-process product search used until the Algolia index is wired up.
 * Typo-tolerant (one edit on words of 4+ letters) with retail synonyms.
 * Pure, so the ranking is unit tested.
 */

export interface SearchDocument {
  id: string;
  slug: string;
  name: string;
  department: string;
  category: string;
  categoryLabel: string;
  keywords: string[];
  image: string;
  imageAlt: string;
  price: number;
  maxPrice: number;
  compareAtPrice?: number;
  salesRank: number;
}

const SYNONYMS: Record<string, string[]> = {
  tee: ["t-shirt", "tshirt", "t"],
  pants: ["trousers", "trouser", "chinos", "chino", "slacks"],
  sweater: ["jumper", "knit", "knitwear", "pullover"],
  jeans: ["denim", "jean"],
  coat: ["jacket", "outerwear", "topcoat", "overcoat"],
  dress: ["dresses", "frock"],
  top: ["blouse", "tops"],
};

/** Light English stemming so plurals match: shirts → shirt, dresses → dress. */
export function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

const CANONICAL = new Map<string, string>();
for (const [canonical, alternatives] of Object.entries(SYNONYMS)) {
  CANONICAL.set(stem(canonical), stem(canonical));
  for (const alt of alternatives) CANONICAL.set(stem(alt), stem(canonical));
}

function rawTokens(text: string): string[] {
  return normalise(text)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(stem);
}

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stemmed tokens with synonyms mapped to their canonical form. */
export function tokenise(text: string): string[] {
  return rawTokens(text).map((t) => CANONICAL.get(t) ?? t);
}

/** Original stems plus canonical forms, so both "oxford" and its typos stay findable. */
function indexTokens(text: string): string[] {
  const raw = rawTokens(text);
  return [...raw, ...raw.map((t) => CANONICAL.get(t) ?? t)];
}

/** True when a and b are within one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** How well one query token matches one document token: 3 exact, 2 prefix, 1 typo. */
function tokenScore(query: string, word: string, isLast: boolean): number {
  if (word === query) return 3;
  if (isLast && query.length >= 2 && word.startsWith(query)) return 2;
  if (query.length >= 4 && word.length >= 4 && withinOneEdit(query, word)) return 1;
  return 0;
}

interface Indexed {
  doc: SearchDocument;
  nameTokens: string[];
  allTokens: string[];
}

export function buildIndex(documents: readonly SearchDocument[]): Indexed[] {
  return documents.map((doc) => {
    const nameTokens = [...new Set(indexTokens(doc.name))];
    return {
      doc,
      nameTokens,
      allTokens: [
        ...new Set([
          ...nameTokens,
          ...indexTokens(doc.category),
          ...doc.keywords.flatMap(indexTokens),
        ]),
      ],
    };
  });
}

export interface SearchResult {
  products: SearchDocument[];
  /** Matching categories, most products first. */
  categories: Array<{ label: string; href: string; count: number }>;
  /** Product names that complete the query, for "suggested searches". */
  suggestions: string[];
  total: number;
}

/** Every query token must match some document token (AND), scored by quality. */
export function search(index: readonly Indexed[], query: string, limit = 4): SearchResult {
  const raw = rawTokens(query);
  // Each query word is tried as typed and as its canonical synonym.
  const queryTokens = raw.map((t) => [...new Set([t, CANONICAL.get(t) ?? t])]);
  if (queryTokens.length === 0) return { products: [], categories: [], suggestions: [], total: 0 };

  const scored: Array<{ doc: SearchDocument; score: number }> = [];
  for (const entry of index) {
    let score = 0;
    let matchedAll = true;
    queryTokens.forEach((variants, i) => {
      const isLast = i === queryTokens.length - 1;
      let best = 0;
      for (const qt of variants) {
        for (const word of entry.allTokens) best = Math.max(best, tokenScore(qt, word, isLast));
      }
      // Matches in the product name rank above matches in category or keywords.
      const inName = variants.some((qt) =>
        entry.nameTokens.some((w) => tokenScore(qt, w, isLast) > 0),
      );
      if (best === 0) matchedAll = false;
      score += best + (inName ? 1 : 0);
    });
    if (matchedAll) scored.push({ doc: entry.doc, score });
  }

  scored.sort((a, b) => b.score - a.score || a.doc.salesRank - b.doc.salesRank);

  const categoryCounts = new Map<string, { label: string; href: string; count: number }>();
  for (const { doc } of scored) {
    const href = `/${doc.department}/${doc.category}`;
    const existing = categoryCounts.get(href);
    if (existing) existing.count += 1;
    else categoryCounts.set(href, { label: doc.categoryLabel, href, count: 1 });
  }

  const suggestions = [
    ...new Set(scored.slice(0, 12).map(({ doc }) => doc.name.toLowerCase())),
  ].slice(0, 5);

  return {
    products: scored.slice(0, limit).map((s) => s.doc),
    categories: [...categoryCounts.values()].sort((a, b) => b.count - a.count).slice(0, 4),
    suggestions,
    total: scored.length,
  };
}
