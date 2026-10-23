/** Pure helpers for reading outbox emails (unit tested). */

const LINK = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** The links in a rendered email, with their visible text. Only http(s) links. */
export function extractLinks(html: string): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  for (const match of html.matchAll(LINK)) {
    const href = decode(match[1] ?? "");
    if (!/^https?:\/\//.test(href)) continue;
    const label = decode((match[2] ?? "").replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (!links.some((l) => l.href === href)) links.push({ label: label || href, href });
  }
  return links;
}
