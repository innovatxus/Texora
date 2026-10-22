/**
 * Reads a video's duration from its container header without decoding it:
 * MP4's `mvhd` box, or WebM's EBML Segment Info (TimecodeScale + Duration).
 * Pure, so it is unit tested; returns null when the header can't be found.
 */
export function videoDurationSeconds(
  bytes: Uint8Array,
  type: "video/mp4" | "video/webm",
): number | null {
  return type === "video/mp4" ? mp4Duration(bytes) : webmDuration(bytes);
}

function mp4Duration(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // `mvhd` lives inside `moov`; scanning for the tag is enough and tolerates box order.
  for (let i = 4; i + 32 < bytes.length; i++) {
    if (
      bytes[i] !== 0x6d ||
      bytes[i + 1] !== 0x76 ||
      bytes[i + 2] !== 0x68 ||
      bytes[i + 3] !== 0x64
    ) {
      continue;
    }
    const version = bytes[i + 4];
    if (version === 1) {
      const timescale = view.getUint32(i + 24);
      const duration = Number(view.getBigUint64(i + 28));
      return timescale > 0 ? duration / timescale : null;
    }
    const timescale = view.getUint32(i + 16);
    const duration = view.getUint32(i + 20);
    return timescale > 0 ? duration / timescale : null;
  }
  return null;
}

/** Reads an EBML variable-length size at `offset`: [value, length in bytes]. */
function readVint(bytes: Uint8Array, offset: number): [number, number] | null {
  const first = bytes[offset];
  if (first === undefined || first === 0) return null;
  let length = 1;
  while (length <= 8 && !(first & (0x80 >> (length - 1)))) length++;
  if (length > 8 || offset + length > bytes.length) return null;
  let value = first & (0xff >> length);
  for (let i = 1; i < length; i++) value = value * 256 + (bytes[offset + i] ?? 0);
  return [value, length];
}

function webmDuration(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let timecodeScale = 1_000_000; // nanoseconds per tick, the WebM default
  let duration: number | null = null;
  for (let i = 0; i + 4 < bytes.length; i++) {
    // TimecodeScale: 0x2AD7B1
    if (bytes[i] === 0x2a && bytes[i + 1] === 0xd7 && bytes[i + 2] === 0xb1) {
      const size = readVint(bytes, i + 3);
      if (size) {
        const [len, sizeLength] = size;
        let value = 0;
        for (let k = 0; k < len; k++) value = value * 256 + (bytes[i + 3 + sizeLength + k] ?? 0);
        if (value > 0) timecodeScale = value;
      }
    }
    // Duration: 0x4489, a 4- or 8-byte float in ticks
    if (bytes[i] === 0x44 && bytes[i + 1] === 0x89) {
      const size = readVint(bytes, i + 2);
      if (!size) continue;
      const [len, sizeLength] = size;
      const at = i + 2 + sizeLength;
      if (len === 4 && at + 4 <= bytes.length) duration = view.getFloat32(at);
      else if (len === 8 && at + 8 <= bytes.length) duration = view.getFloat64(at);
      if (duration !== null) break;
    }
  }
  return duration === null ? null : (duration * timecodeScale) / 1e9;
}
