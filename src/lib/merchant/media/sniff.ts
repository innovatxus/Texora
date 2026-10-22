/**
 * File type detection from the bytes themselves (magic numbers), never from
 * the file name or the browser's Content-Type, which a client controls.
 */
export type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/svg+xml"
  | "video/mp4"
  | "video/webm";

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** The real type of a file, or null when it isn't one we accept. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 12) return looksLikeSvg(bytes) ? "image/svg+xml" : null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash"].includes(brand)) {
      return "video/mp4";
    }
    return null;
  }
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  return looksLikeSvg(bytes) ? "image/svg+xml" : null;
}

/** An XML document whose root element is <svg>, allowing a BOM, XML declaration and comments. */
function looksLikeSvg(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.subarray(0, 4096))
    .replace(/^﻿/, "")
    .trimStart();
  const withoutProlog = head
    .replace(/^<\?xml[\s\S]*?\?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/i, "")
    .trimStart();
  return /^<svg[\s>]/i.test(withoutProlog);
}
