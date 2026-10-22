// Checks per-route JavaScript budgets after `next build` (D-086): the
// product editor may ship 250 KB gzipped, every other merchant portal route
// 120 KB, and storefront and checkout routes 170 KB (spec 10). A route's JS
// is every chunk its layouts and page load (from the client reference manifest) beyond the framework runtime every page shares
// (React and the Next.js router, reported separately). Polyfills are
// `nomodule`, so modern browsers never download them. Run with `npm run budget`.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

// The build folder (the test suite builds into .next-e2e).
const NEXT = process.env.NEXT_DIST_DIR ?? ".next";
const KB = 1024;
const EDITOR = 250 * KB;
const DEFAULT = 120 * KB;
/** Storefront and checkout pages (spec 10: JS per route < 170 KB gz). */
const STOREFRONT = 170 * KB;
/** Routes under these prefixes are budgeted. */
const SCOPES = ["(merchant)", "(merchant-auth)", "(storefront)", "(checkout)"];

const buildManifest = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8"));
const rootFiles = buildManifest.rootMainFiles ?? [];

const gzCache = new Map();
function gz(file) {
  if (!gzCache.has(file)) {
    gzCache.set(file, gzipSync(readFileSync(join(NEXT, file)), { level: 9 }).length);
  }
  return gzCache.get(file);
}

function manifests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...manifests(path));
    else if (entry.name === "page_client-reference-manifest.js") out.push(path);
  }
  return out;
}

const appDir = join(NEXT, "server", "app");
const rows = [];
for (const scope of SCOPES) {
  const dir = join(appDir, scope);
  if (!existsSync(dir)) continue;
  for (const file of manifests(dir)) {
    globalThis.__RSC_MANIFEST = {};
    // The manifest is a script that assigns to globalThis.__RSC_MANIFEST.
    new Function(readFileSync(file, "utf8"))();
    const manifest = Object.values(globalThis.__RSC_MANIFEST)[0];
    const route =
      "/" +
      relative(appDir, file)
        .split(sep)
        .slice(0, -1)
        .filter((s) => !/^\(.*\)$/.test(s))
        .join("/");
    // Error boundaries load only when they render; count the layouts and the page.
    const entries = Object.entries(manifest.entryJSFiles).filter(
      ([key]) => key.endsWith("/layout") || key.endsWith("/page"),
    );
    const files = new Set(
      entries.flatMap(([, list]) => list).filter((f) => !rootFiles.includes(f)),
    );
    const bytes = [...files].reduce((sum, f) => sum + gz(f), 0);
    const budget = /^\/merchant\/products\/\[id\]$/.test(route)
      ? EDITOR
      : scope === "(storefront)" || scope === "(checkout)"
        ? STOREFRONT
        : DEFAULT;
    rows.push({ route, bytes, budget });
  }
}

rows.sort((a, b) => a.route.localeCompare(b.route));
const framework = rootFiles.reduce((sum, f) => sum + gz(f), 0);
console.log(`Framework runtime (shared by every page): ${(framework / KB).toFixed(1)} KB gz
`);
console.log("     route JS   budget  first load  route");
let failed = 0;
for (const { route, bytes, budget } of rows) {
  const ok = bytes <= budget;
  if (!ok) failed++;
  console.log(
    `${ok ? "ok  " : "OVER"} ${(bytes / KB).toFixed(1).padStart(6)} KB  ${String(budget / KB).padStart(4)} KB  ${((bytes + framework) / KB).toFixed(1).padStart(7)} KB  ${route}`,
  );
}
if (rows.length === 0) {
  console.error("No portal routes found. Run `npm run build` first.");
  process.exit(1);
}
console.log(`\n${rows.length} routes, ${failed} over budget.`);
process.exit(failed ? 1 : 0);
