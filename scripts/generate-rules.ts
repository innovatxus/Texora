// Generates firestore.rules and storage.rules from their templates and the role
// bundles in src/lib/auth/rbac.ts. Run `npm run rules:generate`; CI runs `--check`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES, rolesWith } from "../src/lib/auth/rbac";

const root = new URL("..", import.meta.url);
const templatePath = fileURLToPath(new URL("firestore/rules.template", root));
const outputPath = fileURLToPath(new URL("firestore.rules", root));
const storageTemplatePath = fileURLToPath(new URL("storage/rules.template", root));
const storageOutputPath = fileURLToPath(new URL("storage.rules", root));

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

const storageHeader =
  "// GENERATED FILE: edit storage/rules.template and run `npm run rules:generate`.\n";
const mediaRoles = `[${rolesWith("merchant.media.write")
  .map((r) => `'${r}'`)
  .join(", ")}]`;
const storageOutput =
  storageHeader +
  readFileSync(storageTemplatePath, "utf8").replace("{{MEDIA_WRITE_ROLES}}", mediaRoles);

const outputs: Array<[path: string, name: string, content: string]> = [
  [outputPath, "firestore.rules", output],
  [storageOutputPath, "storage.rules", storageOutput],
];

if (process.argv.includes("--check")) {
  let stale = false;
  for (const [path, name, content] of outputs) {
    if (readFileSync(path, "utf8") !== content) {
      console.error(`${name} is out of date. Run \`npm run rules:generate\`.`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log("firestore.rules and storage.rules are up to date.");
} else {
  for (const [path, , content] of outputs) writeFileSync(path, content);
  console.log(
    `Wrote firestore.rules (${ROLES.length} roles, ${new Set(referenced).size} permissions referenced) and storage.rules.`,
  );
}
