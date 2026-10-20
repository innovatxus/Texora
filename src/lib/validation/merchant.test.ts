import { readFileSync } from "node:fs";
import {
  isReservedName,
  LOCATION_TYPES,
  PROCESSING_TIMES,
  SHOP_ACCENTS,
  SHOP_TYPES,
  SIZE_RUNS,
} from "@/config/merchant";
import { SIZE_TYPES } from "./common";
import {
  ACCENT_VALUES,
  e164PhoneSchema,
  LOCATION_TYPE_VALUES,
  merchantEmailSchema,
  merchantStockKey,
  PROCESSING_TIME_VALUES,
  returnPolicySchema,
  SHOP_TYPE_VALUES,
  shopSlugSchema,
  shopSocialSchema,
  specialHoursSchema,
  suggestShopSlug,
  usernameSchema,
  websiteSchema,
  weeklyHoursProblems,
} from "./merchant";

const message = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : result.error?.issues[0]?.message;

describe("usernameSchema", () => {
  it.each(["ada", "ada.lovelace", "maison_rue-22", "a1b", "x".repeat(30)])("accepts %s", (u) => {
    expect(usernameSchema.safeParse(u).success).toBe(true);
  });

  it("normalises case and whitespace", () => {
    expect(usernameSchema.parse("  Ada.Lovelace ")).toBe("ada.lovelace");
  });

  it.each([
    ["ab", "Use 3 to 30 characters"],
    ["x".repeat(31), "Use 3 to 30 characters"],
    ["ada lovelace", "Use lowercase letters, numbers, dots, dashes or underscores"],
    ["ada!", "Use lowercase letters, numbers, dots, dashes or underscores"],
    ["-ada", "Start and end with a letter or number"],
    ["ada.", "Start and end with a letter or number"],
    ["admin", "That name is reserved — try another"],
    ["support", "That name is reserved — try another"],
    ["checkout", "That name is reserved — try another"],
    ["texora-official", "That name is reserved — try another"],
  ])("rejects %s with a clear message", (u, expected) => {
    expect(message(usernameSchema.safeParse(u))).toBe(expected);
  });
});

describe("shop addresses", () => {
  it("accepts and rejects slugs", () => {
    expect(shopSlugSchema.safeParse("maison-rue").success).toBe(true);
    expect(shopSlugSchema.safeParse("ab").success).toBe(false);
    expect(shopSlugSchema.safeParse("maison--rue").success).toBe(false);
    expect(shopSlugSchema.safeParse("shops").success).toBe(false);
    expect(message(shopSlugSchema.safeParse("help"))).toBe("That address is reserved");
  });

  it.each([
    ["Maison Rue & Co.", "maison-rue-and-co"],
    ["Café Noir", "cafe-noir"],
    ["  --Hello   World--  ", "hello-world"],
    ["A".repeat(50), "a".repeat(40)],
  ])("suggests %s → %s", (name, slug) => {
    expect(suggestShopSlug(name)).toBe(slug);
  });

  it("never suggests a trailing dash after truncation", () => {
    expect(suggestShopSlug(`${"a".repeat(39)} b`)).toBe("a".repeat(39));
  });
});

describe("contact fields", () => {
  it("normalises email", () => {
    expect(merchantEmailSchema.parse(" Ada@Example.COM ")).toBe("ada@example.com");
    expect(merchantEmailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("requires E.164 phones and https websites", () => {
    expect(e164PhoneSchema.safeParse("+12125550123").success).toBe(true);
    expect(e164PhoneSchema.safeParse("212-555-0123").success).toBe(false);
    expect(websiteSchema.safeParse("https://maisonrue.com").success).toBe(true);
    expect(websiteSchema.safeParse("http://maisonrue.com").success).toBe(false);
    expect(websiteSchema.safeParse("javascript:alert(1)").success).toBe(false);
  });

  it("strips a leading @ from social handles and validates the format", () => {
    expect(shopSocialSchema.parse({ instagram: "@maison.rue" })).toEqual({
      instagram: "maison.rue",
    });
    expect(shopSocialSchema.safeParse({ instagram: "maison..rue" }).success).toBe(false);
    expect(shopSocialSchema.safeParse({ facebook: "abc" }).success).toBe(false);
  });
});

describe("return policy", () => {
  it("allows the platform policy or a custom window from the list", () => {
    expect(returnPolicySchema.safeParse({ mode: "platform" }).success).toBe(true);
    expect(returnPolicySchema.safeParse({ mode: "custom", windowDays: 14 }).success).toBe(true);
    expect(returnPolicySchema.safeParse({ mode: "custom", windowDays: 0 }).success).toBe(true);
    expect(returnPolicySchema.safeParse({ mode: "custom", windowDays: 21 }).success).toBe(false);
  });
});

describe("hours", () => {
  it("accepts up to two ordered ranges a day", () => {
    expect(
      weeklyHoursProblems([
        { day: 1, open: "09:00", close: "12:00" },
        { day: 1, open: "13:00", close: "18:00" },
      ]),
    ).toEqual([]);
  });

  it("reports reversed, overlapping and too many ranges by day name", () => {
    expect(weeklyHoursProblems([{ day: 2, open: "18:00", close: "09:00" }])).toEqual([
      "Closing time must be after opening time on Tuesday",
    ]);
    expect(
      weeklyHoursProblems([
        { day: 0, open: "09:00", close: "13:00" },
        { day: 0, open: "12:00", close: "17:00" },
      ]),
    ).toEqual(["Ranges on Sunday overlap"]);
    expect(
      weeklyHoursProblems([
        { day: 6, open: "08:00", close: "09:00" },
        { day: 6, open: "10:00", close: "11:00" },
        { day: 6, open: "12:00", close: "13:00" },
      ]),
    ).toContain("Use at most 2 time ranges on Saturday");
  });

  it("needs times for special hours that aren't a closure", () => {
    expect(specialHoursSchema.safeParse({ date: "2026-12-24", closed: true }).success).toBe(true);
    expect(specialHoursSchema.safeParse({ date: "2026-12-24", closed: false }).success).toBe(false);
    expect(
      specialHoursSchema.safeParse({
        date: "2026-12-24",
        closed: false,
        open: "10:00",
        close: "15:00",
      }).success,
    ).toBe(true);
  });
});

describe("merchant config", () => {
  it("matches the schema enums", () => {
    expect(SHOP_TYPES.map((t) => t.value)).toEqual([...SHOP_TYPE_VALUES]);
    expect(SHOP_ACCENTS.map((a) => a.key)).toEqual([...ACCENT_VALUES]);
    expect(PROCESSING_TIMES.map((p) => p.value)).toEqual([...PROCESSING_TIME_VALUES]);
    expect(LOCATION_TYPES.map((l) => l.value)).toEqual([...LOCATION_TYPE_VALUES]);
  });

  it("has no pickup location type (D-071)", () => {
    expect(LOCATION_TYPES.map((l) => l.value)).not.toContain("pickup");
  });

  it("defines a token for every shop accent", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    for (const { key } of SHOP_ACCENTS) expect(css).toContain(`--color-shop-${key}:`);
  });

  it("has a size run for every size type, with unique sizes", () => {
    for (const type of SIZE_TYPES) {
      const runs = SIZE_RUNS[type];
      expect(runs.length).toBeGreaterThan(0);
      for (const run of runs) expect(new Set(run.sizes).size).toBe(run.sizes.length);
    }
    expect(SIZE_RUNS.alpha[0]?.sizes.at(-1)).toBe("4XL");
    expect(SIZE_RUNS.numeric[0]?.sizes.slice(0, 3)).toEqual(["00", "0", "2"]);
    expect(SIZE_RUNS.numeric[0]?.sizes.at(-1)).toBe("24");
  });

  it("reserves route names and the brand", () => {
    for (const name of ["admin", "merchant", "shops", "orders", "texora", "mytexora"]) {
      expect(isReservedName(name)).toBe(true);
    }
    expect(isReservedName("maison-rue")).toBe(false);
  });

  it("namespaces merchant stock keys", () => {
    expect(merchantStockKey("s1", "l1")).toBe("m_s1_l1");
  });
});
