import { readdirSync } from "node:fs";
import { join } from "node:path";
import { isKnownPath, STATIC_TOP_LEVEL_ROUTES } from "./routes";

/** Static top-level route folders under src/app, looking through route groups. */
function staticTopLevelFolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const name = entry.name;
      if (name.startsWith("(") && name.endsWith(")")) return staticTopLevelFolders(join(dir, name));
      if (name.startsWith("[") || name.startsWith("_") || name.startsWith("@")) return [];
      return [name];
    });
}

describe("route allow-list", () => {
  it("matches the static route folders in src/app", () => {
    // A folder can appear in more than one route group (e.g. merchant auth vs portal).
    const folders = [...new Set(staticTopLevelFolders(join(process.cwd(), "src", "app")))].sort();
    expect([...STATIC_TOP_LEVEL_ROUTES].sort()).toEqual(folders);
  });

  it.each([
    ["/", true],
    ["/women", true],
    ["/men/shirts", true],
    ["/sale/women", true],
    ["/collections/knitwear", true],
    ["/icon.svg", true],
    ["/_next/static/chunk.js", true],
    ["/kids", false],
    ["/kids/dresses", false],
    ["/wp-admin", false],
  ])("%s → %s", (path, known) => {
    expect(isKnownPath(path)).toBe(known);
  });
});
