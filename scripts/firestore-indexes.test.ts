import { readFileSync } from "node:fs";

// The emulators ignore index definitions, so a duplicate only fails on a real
// project (HTTP 409 "index already exists" during `firebase deploy`).
const config = JSON.parse(readFileSync("firestore.indexes.json", "utf8")) as {
  indexes: Array<{ collectionGroup: string; queryScope?: string; fields: unknown[] }>;
};

describe("firestore.indexes.json", () => {
  it("defines each composite index once", () => {
    const keys = config.indexes.map((i) =>
      JSON.stringify([i.collectionGroup, i.queryScope ?? "COLLECTION", i.fields]),
    );
    const duplicates = keys.filter((k, n) => keys.indexOf(k) !== n);
    expect(duplicates).toEqual([]);
  });
});
