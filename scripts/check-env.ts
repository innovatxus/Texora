/**
 * Runs before `npm run build` (locally and on Vercel): checks the environment
 * against the same schemas the app uses and prints a short list of missing or
 * invalid variables, names only, never values. Fails fast so the reason is
 * the first thing in the build log instead of a stack trace further down.
 */
import { loadEnvConfig } from "@next/env";
import { clientEnvSchema, serverEnvSchema } from "../src/lib/env/schema";

const NODE_ENV = process.env.NODE_ENV ?? "production";
loadEnvConfig(process.cwd(), NODE_ENV === "development");

// A blank `KEY=` line means "not set", as in the app.
const env: Record<string, string | undefined> = { ...process.env, NODE_ENV };
const source = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ""));

const problems: string[] = [];
for (const [label, schema] of [
  ["browser", clientEnvSchema],
  ["server", serverEnvSchema],
] as const) {
  const result = schema.safeParse(source);
  if (result.success) continue;
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "(root)";
    const missing = source[key] === undefined;
    problems.push(`  ✗ ${key} (${label}): ${missing ? "missing" : issue.message}`);
    if (missing) {
      // A key saved with a stray space, different case or as "KEY=value" in the name field.
      const similar = Object.keys(process.env).filter(
        (name) =>
          name !== key &&
          name
            .replace(/[^A-Z0-9_]/gi, "")
            .toUpperCase()
            .startsWith(key),
      );
      for (const name of similar) {
        problems.push(`      found a similar key "${name}": rename it to exactly ${key}`);
      }
      if (process.env[key] === "") problems.push(`      ${key} exists but its value is empty`);
    }
  }
}

if (problems.length > 0) {
  console.error(
    [
      "",
      "Environment check failed. Add or fix these variables (Vercel: Settings → Environment",
      "Variables, ticked for the environment being built), then redeploy:",
      ...(process.env.VERCEL_ENV
        ? [`  (this build runs in Vercel's "${process.env.VERCEL_ENV}" environment)`]
        : []),
      ...[...new Set(problems)],
      "",
      "See README → Deploy → Vercel for the full list.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
console.log("✓ Environment check passed");
