import { describe, expect, it } from "vitest";
import { csvField, parseCsv, parseCsvRecords, toCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, newlines and doubled quotes", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "two\nlines", "3"],
    ]);
  });

  it("skips blank lines and a byte-order mark", () => {
    expect(parseCsv("﻿id,name\n\n1,Tee\n")).toEqual([
      ["id", "name"],
      ["1", "Tee"],
    ]);
  });

  it("keeps empty fields", () => {
    expect(parseCsv("a,,c")).toEqual([["a", "", "c"]]);
  });
});

describe("parseCsvRecords", () => {
  it("keys rows by a normalised header", () => {
    expect(parseCsvRecords(" ID ,Name\np1, Linen Shirt \n")).toEqual([
      { id: "p1", name: "Linen Shirt" },
    ]);
  });
});

describe("csvField and toCsv", () => {
  it("quotes only when needed and defuses formulas", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField(null)).toBe("");
  });

  it("round-trips through the parser", () => {
    const text = toCsv(["id", "name"], [["p1", 'Shirt, "Oxford"']]);
    expect(parseCsvRecords(text)).toEqual([{ id: "p1", name: 'Shirt, "Oxford"' }]);
  });
});
