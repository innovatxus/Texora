import { isCommonPassword, passwordProblem, passwordScore } from "./password";

describe("passwordScore", () => {
  it.each([
    "violet-harbour-stitch-42",
    "correct horse battery staple",
    "Mx7#qL9!vR2$wT",
    "our linen dresses ship tuesday",
  ])("rates %s as strong enough", (password) => {
    expect(passwordScore(password)).toBeGreaterThanOrEqual(3);
  });

  it.each([
    "password1234",
    "P@ssw0rd2026!",
    "aaaaaaaaaaaa",
    "abcdefghijkl",
    "123456789012",
    "qwertyuiop12",
    "abcabcabcabc",
    "januaryjanuary",
  ])("rates %s as too weak", (password) => {
    expect(passwordScore(password)).toBeLessThan(3);
  });

  it("penalises the email and username", () => {
    const inputs = ["ada.lovelace@maisonrue.com", "maisonrue"];
    expect(passwordScore("maisonrue-lovelace", inputs)).toBeLessThan(
      passwordScore("maisonrue-lovelace"),
    );
  });

  it("gets stronger as a phrase gets longer", () => {
    expect(passwordScore("violet")).toBeLessThan(passwordScore("violet harbour stitch"));
  });
});

describe("isCommonPassword", () => {
  it.each(["password", "Password123", "P@ssw0rd", "qwerty!!", "iloveyou2026", "TEXORA"])(
    "flags %s",
    (password) => expect(isCommonPassword(password)).toBe(true),
  );

  it("passes unusual phrases", () => {
    expect(isCommonPassword("violet-harbour-stitch")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("checks length first, then common passwords, then strength", () => {
    expect(passwordProblem("short")).toBe("Use at least 12 characters");
    expect(passwordProblem("x".repeat(129))).toBe("Use 128 characters or fewer");
    expect(passwordProblem("password123!")).toBe(
      "That password is too common — try a phrase only you would use",
    );
    expect(passwordProblem("aaaaaaaaaaaa")).toBe(
      "Add a few more words or characters to make it stronger",
    );
    expect(passwordProblem("violet-harbour-stitch-42")).toBeNull();
  });

  it("has no composition rules", () => {
    expect(passwordProblem("violet harbour stitch lantern")).toBeNull();
  });
});
