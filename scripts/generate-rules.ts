// Generates firestore.rules from firestore/rules.template and the role bundles
// in src/lib/auth/rbac.ts. Run `npm run rules:generate`; CI runs `--check`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../src/lib/auth/rbac";

const root = new URL("..", import.meta.url);
const templatePath = fileURLToPath(new URL("firestore/rules.template", root));
const outputPath = fileURLToPath(new URL("firestore.rules", root));

const template = readFileSync(templatePath, "utf8");

// Every permission named in the template must exist in rbac.ts.
const referenced = [...template.matchAll(/can\('([a-z_.]+)'\)/g)].map((m) => m[1] ?? "");
const unknown = referenced.filter((p) => !(PERMISSIONS as readonly string[]).includes(p));
if (unknown.length > 0) {
  console.error(`Unknown permissions in rules template: ${[...new Set(unknown)].join(", ")}`);
  process.exit(1);
}

const indent = "        ";
const map = [
  "{",
  ...ROLES.map((role, i) => {
    const perms = ROLE_PERMISSIONS[role].map((p) => `'${p}'`).join(", ");
    return `${indent}'${role}': [${perms}]${i < ROLES.length - 1 ? "," : ""}`;
  }),
  "      }",
].join("\n");

const header =
  "// GENERATED FILE: edit firestore/rules.template and run `npm run rules:generate`.\n";
const output = header + template.replace("{{ROLE_PERMISSIONS}}", map);

if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8");
  if (current !== output) {
    console.error("firestore.rules is out of date. Run `npm run rules:generate`.");
    process.exit(1);
  }
  console.log("firestore.rules is up to date.");
} else {
  writeFileSync(outputPath, output);
  console.log(
    `Wrote firestore.rules (${ROLES.length} roles, ${new Set(referenced).size} permissions referenced).`,
  );
}
