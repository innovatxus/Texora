import {
  acceptAttribute,
  clampCrop,
  cropAspect,
  defaultCrop,
  dimensionProblem,
  fileProblem,
} from "./rules";
import { sniffType } from "./sniff";
import { svgProblem } from "./svg";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffType", () => {
  it("recognises image and video signatures", () => {
    expect(sniffType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffType(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffType(text("\u0000\u0000\u0000\u001cftypavif\u0000\u0000"))).toBe("image/avif");
    expect(sniffType(text("\u0000\u0000\u0000\u001cftypisom\u0000\u0000"))).toBe("video/mp4");
    expect(sniffType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe("video/webm");
  });

  it("recognises SVG with a BOM, declaration and comments", () => {
    expect(sniffType(text('﻿<?xml version="1.0"?>\n<!-- logo --><svg viewBox="0 0 1 1"/>'))).toBe(
      "image/svg+xml",
    );
  });

  it("ignores the file name and declared type: HTML and executables are rejected", () => {
    expect(sniffType(text("<!doctype html><html><script>alert(1)</script>"))).toBeNull();
    expect(sniffType(bytes(0x4d, 0x5a, 0x90, 0x00))).toBeNull(); // Windows executable
    expect(sniffType(bytes(0x25, 0x50, 0x44, 0x46))).toBeNull(); // PDF
    expect(sniffType(text("GIF89a......"))).toBeNull();
    expect(sniffType(new Uint8Array(0))).toBeNull();
  });
});

describe("svgProblem", () => {
  it("passes plain vector artwork", () => {
    expect(
      svgProblem(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/><use href="#g"/></svg>',
      ),
    ).toBeNull();
  });

  it.each([
    ["<svg><script>alert(1)</script></svg>", "script"],
    ['<svg onload="alert(1)"></svg>', "event handler"],
    ["<svg><foreignObject><div/></foreignObject></svg>", "foreign content"],
    ['<svg><a href="javascript:alert(1)">x</a></svg>', "script URL"],
    ['<svg><image href="https://evil.example/x.png"/></svg>', "external reference"],
    ['<svg><use xlink:href="http://evil.example/s.svg#a"/></svg>', "external reference"],
    ['<svg><rect style="fill:url(https://evil.example/t)"/></svg>', "external reference"],
    [
      '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
      "entity declaration",
    ],
    ["<svg><style>@import 'https://evil.example/a.css';</style></svg>", "stylesheet import"],
    ["<svg><iframe src='x'/></svg>", "embedded content"],
  ])("refuses %s (%s)", (markup, reason) => {
    expect(svgProblem(markup)).toBe(reason);
  });
});

describe("fileProblem", () => {
  it("names the accepted types for each kind", () => {
    expect(fileProblem("logo", "image/gif", 100)).toBe(
      "That file type isn't supported. Use PNG, JPG, WebP or SVG.",
    );
    expect(fileProblem("banner", "image/svg+xml", 100)).toBe(
      "That file type isn't supported. Use PNG, JPG or WebP.",
    );
  });

  it("states the size and the limit", () => {
    expect(fileProblem("logo", "image/png", 7.2 * 1024 * 1024)).toBe(
      "That file is 7.2 MB — the limit is 5 MB.",
    );
    expect(fileProblem("productImage", "image/jpeg", 16 * 1024 * 1024)).toBe(
      "That file is 16 MB — the limit is 15 MB.",
    );
    expect(fileProblem("logo", "image/png", 0)).toBe("That file is empty.");
    expect(fileProblem("banner", "image/webp", 9 * 1024 * 1024)).toBeNull();
  });

  it("builds the input accept attribute", () => {
    expect(acceptAttribute("banner")).toBe("image/png,image/jpeg,image/webp");
  });
});

describe("dimensionProblem", () => {
  it("checks minimums per kind and skips SVG", () => {
    expect(dimensionProblem("logo", 300, 300, "image/png")).toBe(
      "Your logo is 300×300 px — use at least 512×512 px.",
    );
    expect(dimensionProblem("logo", 10, 10, "image/svg+xml")).toBeNull();
    expect(dimensionProblem("banner", 2400, 700, "image/jpeg")).toBe(
      "Your banner is 2400×700 px — use at least 2400×800 px.",
    );
    expect(dimensionProblem("productImage", 1200, 1500, "image/jpeg")).toBe(
      "That photo is 1200×1500 px — use at least 1600 px on the long edge.",
    );
    expect(dimensionProblem("productImage", 1200, 1600, "image/jpeg")).toBeNull();
  });
});

describe("crops", () => {
  it("centres the largest crop of the kind's aspect", () => {
    expect(cropAspect("logo")).toBe(1);
    expect(defaultCrop(2000, 1000, 1)).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    const banner = defaultCrop(3000, 2000, 3);
    expect(banner.width).toBe(1);
    expect(banner.height).toBeCloseTo(0.5);
    expect(banner.y).toBeCloseTo(0.25);
    expect(defaultCrop(100, 100, null)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("keeps a crop inside the image", () => {
    expect(clampCrop({ x: 0.9, y: -0.2, width: 0.5, height: 0.5 })).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
    expect(clampCrop({ x: 0, y: 0, width: 0, height: 2 })).toEqual({
      x: 0,
      y: 0,
      width: 0.05,
      height: 1,
    });
  });
});
