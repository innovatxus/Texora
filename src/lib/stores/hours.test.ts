import { describe, expect, it } from "vitest";
import { distanceMiles, formatTime, localTime, openStatus, weeklyHours } from "./hours";

const store = {
  timezone: "America/New_York",
  status: "open" as const,
  // Mon–Sat 10–20, Sunday 11–18.
  hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    open: day === 0 ? "11:00" : "10:00",
    close: day === 0 ? "18:00" : "20:00",
  })),
};

// 2026-10-19 is a Monday. New York is UTC−4 in October.
const ny = (hour: number, minute = 0, date = 19) =>
  new Date(Date.UTC(2026, 9, date, hour + 4, minute));

describe("formatTime", () => {
  it("formats 24h times compactly", () => {
    expect(formatTime("20:00")).toBe("8pm");
    expect(formatTime("10:30")).toBe("10:30am");
    expect(formatTime("00:00")).toBe("12am");
    expect(formatTime("12:00")).toBe("12pm");
  });
});

describe("localTime", () => {
  it("reads the store's own clock", () => {
    expect(localTime(ny(9, 15), "America/New_York")).toEqual({ day: 1, minutes: 555 });
    // Same instant in Chicago is an hour earlier.
    expect(localTime(ny(9, 15), "America/Chicago")).toEqual({ day: 1, minutes: 495 });
  });
});

describe("openStatus", () => {
  it("is open during hours", () => {
    expect(openStatus(store, ny(12))).toEqual({ open: true, label: "Open until 8pm" });
  });

  it("says when it opens later today", () => {
    expect(openStatus(store, ny(8))).toEqual({ open: false, label: "Closed · opens 10am" });
  });

  it("looks ahead to tomorrow after closing", () => {
    expect(openStatus(store, ny(21))).toEqual({
      open: false,
      label: "Closed · opens 10am tomorrow",
    });
    // Saturday night → Sunday's later opening.
    expect(openStatus(store, ny(21, 0, 24)).label).toBe("Closed · opens 11am tomorrow");
  });

  it("closes exactly at closing time", () => {
    expect(openStatus(store, ny(20)).open).toBe(false);
  });

  it("names the day when the next opening is further away", () => {
    const weekdaysOnly = { ...store, hours: store.hours.filter((h) => h.day !== 0 && h.day !== 6) };
    expect(openStatus(weekdaysOnly, ny(21, 0, 23)).label).toBe("Closed · opens 10am Monday");
  });

  it("reports temporary closures", () => {
    expect(openStatus({ ...store, status: "temporarily_closed" }, ny(12))).toEqual({
      open: false,
      label: "Temporarily closed",
    });
  });
});

describe("weeklyHours", () => {
  it("lists Monday first", () => {
    const week = weeklyHours(store);
    expect(week[0]).toEqual({ day: 1, text: "10am – 8pm" });
    expect(week[6]).toEqual({ day: 0, text: "11am – 6pm" });
  });
});

describe("distanceMiles", () => {
  it("measures New York to Chicago at about 710 miles", () => {
    const d = distanceMiles({ lat: 40.7246, lng: -73.9992 }, { lat: 41.8935, lng: -87.6245 });
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(720);
  });

  it("is zero for the same point", () => {
    expect(distanceMiles({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe("merchant hours (two ranges, special dates)", () => {
  // Monday 2026-10-19, New York.
  const at = (time: string) => new Date(`2026-10-19T${time}:00-04:00`);
  const location = {
    timezone: "America/New_York",
    hours: [
      { day: 1, open: "09:00", close: "12:00" },
      { day: 1, open: "13:00", close: "18:00" },
      { day: 2, open: "10:00", close: "16:00" },
    ],
  };

  it("handles a lunch break", () => {
    expect(openStatus(location, at("10:00"))).toEqual({ open: true, label: "Open until 12pm" });
    expect(openStatus(location, at("12:30"))).toEqual({ open: false, label: "Closed · opens 1pm" });
    expect(openStatus(location, at("14:00"))).toEqual({ open: true, label: "Open until 6pm" });
    expect(openStatus(location, at("19:00")).label).toBe("Closed · opens 10am tomorrow");
  });

  it("applies special hours for a date", () => {
    const holiday = { ...location, specialHours: [{ date: "2026-10-19", closed: true }] };
    expect(openStatus(holiday, at("10:00")).label).toBe("Closed · opens 10am tomorrow");
    const short = {
      ...location,
      specialHours: [{ date: "2026-10-20", closed: false, open: "12:00", close: "14:00" }],
    };
    expect(openStatus(short, at("19:00")).label).toBe("Closed · opens 12pm tomorrow");
  });

  it("lists both ranges for a day", () => {
    expect(weeklyHours(location)[0]).toEqual({ day: 1, text: "9am – 12pm, 1pm – 6pm" });
  });
});
