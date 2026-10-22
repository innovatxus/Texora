import "server-only";
import sharp, { type Metadata, type OutputInfo, type Sharp } from "sharp";
import { MERCHANT_LIMITS, type MediaKind } from "@/config/merchant";
import {
  acceptsType,
  clampCrop,
  cropAspect,
  defaultCrop,
  dimensionProblem,
  fileProblem,
  type CropRect,
} from "./rules";
import { sniffType } from "./sniff";
import { svgProblem } from "./svg";
import { videoDurationSeconds } from "./video";

/** A file that can't be used, with merchant-facing copy. */
export class MediaRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaRejectedError";
  }
}

export interface ProcessedImage {
  type: "image";
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  blurDataURL: string;
  dominantColor: string;
}

export interface ProcessedVideo {
  type: "video";
  buffer: Buffer;
  contentType: "video/mp4" | "video/webm";
  extension: "mp4" | "webm";
  durationSeconds: number;
}

export type ProcessedMedia = ProcessedImage | ProcessedVideo;

/** Longest edge kept per kind; larger originals are scaled down, smaller ones never up. */
const MAX_EDGE: Readonly<Record<Exclude<MediaKind, "productVideo">, number>> = {
  logo: 1024,
  banner: 3600,
  productImage: 2400,
};

/** Bound on decoded pixels, so a crafted "decompression bomb" can't exhaust memory. */
const PIXEL_LIMIT = 100_000_000;

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");

async function placeholder(image: Buffer): Promise<{ blurDataURL: string; dominantColor: string }> {
  const tiny = await sharp(image)
    .resize(16, 16, { fit: "inside" })
    .webp({ quality: 40 })
    .toBuffer();
  const { dominant } = await sharp(image).stats();
  return {
    blurDataURL: `data:image/webp;base64,${tiny.toString("base64")}`,
    dominantColor: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
  };
}

/**
 * Validates and processes an uploaded file. The type comes from the bytes,
 * not the client. Images are decoded, auto-rotated, cropped, scaled and
 * re-encoded as WebP, which drops EXIF, GPS and any other metadata. SVG logos
 * are checked for anything executable, then rasterised, so no SVG is served.
 */
export async function processUpload(
  kind: MediaKind,
  input: Uint8Array,
  options: { crop?: CropRect | undefined } = {},
): Promise<ProcessedMedia> {
  const sniffed = sniffType(input);
  const type = sniffed ?? "application/octet-stream";
  const basic = fileProblem(kind, type, input.byteLength);
  if (basic) throw new MediaRejectedError(basic);
  if (!sniffed || !acceptsType(kind, sniffed)) {
    throw new MediaRejectedError(
      fileProblem(kind, "unknown", 1) ?? "That file type isn't supported.",
    );
  }

  if (sniffed === "video/mp4" || sniffed === "video/webm") {
    const duration = videoDurationSeconds(input, sniffed);
    if (duration === null) {
      throw new MediaRejectedError("We couldn't read that video. Export it again as MP4.");
    }
    if (duration > MERCHANT_LIMITS.productVideo.maxSeconds + 0.5) {
      throw new MediaRejectedError(
        `That video is ${Math.round(duration)} seconds — keep it to ${MERCHANT_LIMITS.productVideo.maxSeconds} seconds.`,
      );
    }
    return {
      type: "video",
      buffer: Buffer.from(input),
      contentType: sniffed,
      extension: sniffed === "video/mp4" ? "mp4" : "webm",
      durationSeconds: duration,
    };
  }
  if (kind === "productVideo") throw new MediaRejectedError("Upload an MP4 or WebM video.");

  let source: Sharp;
  if (sniffed === "image/svg+xml") {
    const markup = new TextDecoder().decode(input);
    const problem = svgProblem(markup);
    if (problem) {
      throw new MediaRejectedError(
        `That SVG contains ${problem === "script" ? "a script" : `an ${problem}`}, which isn't allowed. Export it as plain artwork, or upload a PNG.`,
      );
    }
    // Rasterised at high density, so the square crop below has detail to work with.
    source = sharp(Buffer.from(markup), { density: 384, limitInputPixels: PIXEL_LIMIT });
  } else {
    source = sharp(input, { limitInputPixels: PIXEL_LIMIT, failOn: "error" });
  }

  let meta: Metadata;
  try {
    meta = await source.metadata();
  } catch {
    throw new MediaRejectedError("We couldn't use that file. Try saving it again as PNG or JPG.");
  }
  const rotated = (meta.orientation ?? 1) >= 5;
  const width = (rotated ? meta.height : meta.width) ?? 0;
  const height = (rotated ? meta.width : meta.height) ?? 0;
  const tooSmall = dimensionProblem(kind, width, height, sniffed);
  if (tooSmall) throw new MediaRejectedError(tooSmall);

  const crop = clampCrop(options.crop ?? defaultCrop(width, height, cropAspect(kind)));
  const region = {
    left: Math.round(crop.x * width),
    top: Math.round(crop.y * height),
    width: Math.max(1, Math.min(width, Math.round(crop.width * width))),
    height: Math.max(1, Math.min(height, Math.round(crop.height * height))),
  };
  region.width = Math.min(region.width, width - region.left);
  region.height = Math.min(region.height, height - region.top);

  const edge = MAX_EDGE[kind];
  let output: { data: Buffer; info: OutputInfo };
  try {
    output = await source
      .rotate() // apply EXIF orientation before cropping; metadata is not carried over
      .extract(region)
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new MediaRejectedError("We couldn't use that file. Try saving it again as PNG or JPG.");
  }

  return {
    type: "image",
    buffer: output.data,
    contentType: "image/webp",
    extension: "webp",
    width: output.info.width,
    height: output.info.height,
    ...(await placeholder(output.data)),
  };
}
