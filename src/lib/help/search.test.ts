import { describe, expect, it } from "vitest";
import { FAQ, HELP_TOPICS } from "@/config/help";
import { searchFaq, tokenize } from "./search";

describe("tokenize", () => {
  it("drops punctuation, stop words and plurals", () => {
    expect(tokenize("How do I return my Jeans?")).toEqual(["return", "jean"]);
  });
});

describe("searchFaq", () => {
  it("puts the most relevant question first", () => {
    expect(searchFaq(FAQ, "refund")[0]?.id).toBe("refund-time");
    expect(searchFaq(FAQ, "gift card balance")[0]?.id).toBe("gift-card-balance");
  });

  it("matches word prefixes", () => {
    expect(searchFaq(FAQ, "track").map((e) => e.id)).toContain("track-order");
  });

  it("requires every word to match", () => {
    expect(searchFaq(FAQ, "refund spaceship")).toEqual([]);
  });

  it("returns nothing for an empty or stop-word query", () => {
    expect(searchFaq(FAQ, "  ")).toEqual([]);
    expect(searchFaq(FAQ, "how do I")).toEqual([]);
  });
});

describe("help content", () => {
  it("has unique FAQ ids and topic slugs", () => {
    expect(new Set(FAQ.map((e) => e.id)).size).toBe(FAQ.length);
    expect(new Set(HELP_TOPICS.map((t) => t.slug)).size).toBe(HELP_TOPICS.length);
  });

  it("only links to internal pages", () => {
    for (const entry of FAQ) {
      if (entry.link) expect(entry.link.href.startsWith("/")).toBe(true);
    }
  });
});
