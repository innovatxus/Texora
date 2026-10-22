// Runs the browser tests end to end in a sandbox. `npm run test:e2e` starts
// the Firebase emulators (offline demo project), then inside them loads
// tests/emulator.env, draws the demo product images, seeds the demo
// catalogue, builds into .next-e2e and runs Playwright. Your live project
// and your live build are never touched.
//
//   npm run test:e2e                 # everything
//   npm run test:e2e -- e2e/account.spec.ts --project desktop
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

for (const line of readFileSync("tests/emulator.env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match?.[1]) process.env[match[1]] = match[2] ?? "";
}
if (!process.env.FIREBASE_PROJECT_ID?.startsWith("demo-")) {
  throw new Error("tests/emulator.env must use a demo- project");
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const args = process.argv.slice(2);

// Outside the emulators: start them (offline demo project) and re-run inside.
if (!args.includes("--inside")) {
  const inner = ["npx", "tsx", "tests/e2e-run.ts", "--inside", ...args]
    .map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    .join(" ");
  run("npx", ["firebase", "emulators:exec", "--project", "demo-texora", JSON.stringify(inner)]);
  process.exit(0);
}

const skipBuild = args.includes("--skip-build");
const playwrightArgs = args.filter((a) => a !== "--skip-build" && a !== "--inside");

run("npx", ["tsx", "tests/fixtures/placeholders.ts"]);
run("npx", ["tsx", "tests/fixtures/seed/index.ts"]);
if (!skipBuild) run("npx", ["next", "build"]);

// A full run takes the screenshots last, on a fresh seed: other tests change
// data (publishing, refunds, points) that would otherwise show up in them.
const selective = playwrightArgs.some((a) => !a.startsWith("--") || a.startsWith("--grep"));
if (selective) {
  run("npx", ["playwright", "test", ...playwrightArgs]);
} else {
  const main = spawnSync(
    "npx",
    ["playwright", "test", "--grep-invert", "@visual", ...playwrightArgs],
    {
      stdio: "inherit",
      shell: true,
      env: process.env,
    },
  );
  run("npx", ["tsx", "tests/fixtures/seed/index.ts"]);
  run("npx", ["playwright", "test", "--grep", "@visual", ...playwrightArgs]);
  if (main.status !== 0) process.exit(main.status ?? 1);
}
