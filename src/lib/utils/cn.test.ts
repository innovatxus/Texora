import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class values", () => {
    expect(cn("a", false, null, undefined, "b", { c: true, d: false })).toBe("a b c");
  });

  it("resolves conflicting token utilities in favour of the last one", () => {
    expect(cn("bg-canvas text-ink", "bg-surface")).toBe("text-ink bg-surface");
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("treats text-label as a font-size utility, not a colour", () => {
    expect(cn("text-sm text-ink", "text-label")).toBe("text-ink text-label");
  });
});
