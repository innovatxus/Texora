import { GOVERNORATE_CODES } from "./locale";
import {
  areaSuggestions,
  egyptAddressProblems,
  governoratesForArea,
  GOVERNORATE_AREAS,
  normalizeArea,
  POSTAL_PREFIXES,
} from "./egypt-address";

describe("Egypt address checks", () => {
  it("covers every governorate", () => {
    for (const code of GOVERNORATE_CODES) {
      expect(GOVERNORATE_AREAS[code as keyof typeof GOVERNORATE_AREAS]?.length).toBeGreaterThan(0);
      expect(POSTAL_PREFIXES[code as keyof typeof POSTAL_PREFIXES]?.length).toBeGreaterThan(0);
    }
  });

  it("compares spellings loosely", () => {
    expect(normalizeArea("El-Mohandessin")).toBe(normalizeArea("mohandessin"));
    expect(governoratesForArea("6th of October")).toEqual(["GZ"]);
    expect(governoratesForArea("  zamalek ")).toEqual(["C"]);
    expect(governoratesForArea("الإسكندرية")).toEqual(["ALX"]);
  });

  it("accepts a matching or unknown area", () => {
    expect(egyptAddressProblems({ city: "Zamalek", region: "C" })).toEqual([]);
    expect(
      egyptAddressProblems({ city: "Sheikh Zayed", region: "GZ", postalCode: "12588" }),
    ).toEqual([]);
    // Villages and new compounds aren't all listed, so unknown names pass.
    expect(egyptAddressProblems({ city: "Kafr Hamza", region: "KB" })).toEqual([]);
    // A name listed in two governorates is fine in either.
    expect(egyptAddressProblems({ city: "Dar El Salam", region: "SHG" })).toEqual([]);
  });

  it("refuses an area that belongs to another governorate", () => {
    expect(egyptAddressProblems({ city: "Smouha", region: "C" })).toEqual([
      {
        path: "city",
        message: "Smouha is in Alexandria, not Cairo. Check the city or choose Alexandria.",
      },
    ]);
    expect(egyptAddressProblems({ city: "Giza", region: "C" })[0]?.path).toBe("city");
  });

  it("checks the postal code against the governorate", () => {
    expect(egyptAddressProblems({ city: "Maadi", region: "C", postalCode: "21500" })).toEqual([
      {
        path: "postalCode",
        message: "21500 is a postal code for Alexandria. Check it, or leave it empty.",
      },
    ]);
    expect(
      egyptAddressProblems({ city: "Maadi", region: "C", postalCode: "99999" })[0]?.message,
    ).toMatch(/isn't an Egyptian postal code/);
    expect(egyptAddressProblems({ city: "Maadi", region: "C", postalCode: "" })).toEqual([]);
  });

  it("needs a name for the city", () => {
    expect(egyptAddressProblems({ city: "123", region: "C" })[0]?.message).toBe(
      "Enter the name of the city or district",
    );
  });

  it("suggests areas for the chosen governorate", () => {
    expect(areaSuggestions("ALX")).toContain("Smouha");
    expect(areaSuggestions("nowhere")).toEqual([]);
  });
});
