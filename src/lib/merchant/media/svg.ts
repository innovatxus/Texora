/**
 * SVG safety check for logos. Uploaded SVGs are rasterised on the server, so
 * no SVG is ever served, but anything that could execute or fetch is refused
 * first (scripts, event handlers, foreign content, external references,
 * entity tricks) so a hostile file never reaches the renderer either.
 */
const DANGEROUS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /<\s*script\b/i, reason: "script" },
  { pattern: /\son[a-z]+\s*=/i, reason: "event handler" },
  { pattern: /<\s*foreignObject\b/i, reason: "foreign content" },
  { pattern: /<\s*(iframe|embed|object|audio|video|canvas)\b/i, reason: "embedded content" },
  { pattern: /<!ENTITY/i, reason: "entity declaration" },
  { pattern: /javascript\s*:/i, reason: "script URL" },
  { pattern: /data\s*:\s*text\/html/i, reason: "HTML data URL" },
  // Only in-document references (#id) are allowed; anything else fetches.
  { pattern: /(?:xlink:)?href\s*=\s*["']\s*(?!#)[^"']+["']/i, reason: "external reference" },
  { pattern: /url\(\s*["']?\s*(?!#)[^)'"]+/i, reason: "external reference" },
  { pattern: /@import\b/i, reason: "stylesheet import" },
];

/** Why an SVG is unsafe, or null when it is plain vector artwork. */
export function svgProblem(markup: string): string | null {
  for (const { pattern, reason } of DANGEROUS) {
    if (pattern.test(markup)) return reason;
  }
  return null;
}
