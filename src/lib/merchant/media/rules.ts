/**
 * Per-kind upload rules: accepted types, size and dimension limits, and the
 * merchant-facing message for each problem. Pure and shared, so the browser
 * rejects a bad file before uploading and the server says exactly the same.
 */
import { MEDIA_TYPES, MERCHANT_LIMITS, type MediaKind } from "@/config/merchant";

const MB = 1024 * 1024;
const formatMb = (bytes: number) => `${(bytes / MB).toFixed(1).replace(/\.0$/, "")} MB`;

const LABELS: Readonly<Record<MediaKind, string>> = {
  logo: "Your logo",
  banner: "Your banner",
  productImage: "That photo",
  productVideo: "That video",
};

const TYPE_LISTS: Readonly<Record<MediaKind, string>> = {
  logo: "PNG, JPG, WebP or SVG",
  banner: "PNG, JPG or WebP",
  productImage: "JPG, PNG, WebP or AVIF",
  productVideo: "MP4 or WebM",
};

/** The byte limit for a kind. */
export function maxBytes(kind: MediaKind): number {
  switch (kind) {
    case "logo":
      return MERCHANT_LIMITS.logo.maxBytes;
    case "banner":
      return MERCHANT_LIMITS.banner.maxBytes;
    case "productImage":
      return MERCHANT_LIMITS.productImage.maxBytes;
    case "productVideo":
      return MERCHANT_LIMITS.productVideo.maxBytes;
  }
}

/** Whether a MIME type is accepted for a kind. */
export function acceptsType(kind: MediaKind, type: string): boolean {
  return (MEDIA_TYPES[kind] as readonly string[]).includes(type);
}

/** The `accept` attribute for a file input. */
export function acceptAttribute(kind: MediaKind): string {
  return MEDIA_TYPES[kind].join(",");
}

/** A problem with the type or size, in merchant-facing words; null when fine. */
export function fileProblem(kind: MediaKind, type: string, bytes: number): string | null {
  if (!acceptsType(kind, type)) {
    return `That file type isn't supported. Use ${TYPE_LISTS[kind]}.`;
  }
  if (bytes <= 0) return "That file is empty.";
  const limit = maxBytes(kind);
  if (bytes > limit) return `That file is ${formatMb(bytes)} — the limit is ${formatMb(limit)}.`;
  return null;
}

/** A problem with an image's dimensions (SVGs are vector and skip this); null when fine. */
export function dimensionProblem(
  kind: MediaKind,
  width: number,
  height: number,
  type: string,
): string | null {
  if (type === "image/svg+xml") return null;
  const label = LABELS[kind];
  switch (kind) {
    case "logo": {
      const { minWidth, minHeight } = MERCHANT_LIMITS.logo;
      return width < minWidth || height < minHeight
        ? `${label} is ${width}×${height} px — use at least ${minWidth}×${minHeight} px.`
        : null;
    }
    case "banner": {
      const { minWidth, minHeight } = MERCHANT_LIMITS.banner;
      return width < minWidth || height < minHeight
        ? `${label} is ${width}×${height} px — use at least ${minWidth}×${minHeight} px.`
        : null;
    }
    case "productImage": {
      const { minLongEdge } = MERCHANT_LIMITS.productImage;
      return Math.max(width, height) < minLongEdge
        ? `${label} is ${width}×${height} px — use at least ${minLongEdge} px on the long edge.`
        : null;
    }
    case "productVideo":
      return null;
  }
}

/** The crop aspect (width / height) a kind is shown at, or null for free-form. */
export function cropAspect(kind: MediaKind): number | null {
  switch (kind) {
    case "logo":
      return 1;
    case "banner":
      return MERCHANT_LIMITS.banner.aspect;
    case "productImage":
      return MERCHANT_LIMITS.productImage.aspect;
    case "productVideo":
      return null;
  }
}

/** A normalised crop rectangle (0–1 of the source image). */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The largest centred crop of a given aspect inside a width × height image,
 * normalised to 0–1. Used as the cropper's starting point and the default
 * when a merchant skips cropping.
 */
export function defaultCrop(width: number, height: number, aspect: number | null): CropRect {
  if (!aspect || width <= 0 || height <= 0) return { x: 0, y: 0, width: 1, height: 1 };
  const imageAspect = width / height;
  if (imageAspect > aspect) {
    const w = aspect / imageAspect;
    return { x: (1 - w) / 2, y: 0, width: w, height: 1 };
  }
  const h = imageAspect / aspect;
  return { x: 0, y: (1 - h) / 2, width: 1, height: h };
}

/** Clamps a crop inside the image and to a minimum size, keeping its position sensible. */
export function clampCrop(crop: CropRect, minSize = 0.05): CropRect {
  const width = Math.min(1, Math.max(minSize, crop.width));
  const height = Math.min(1, Math.max(minSize, crop.height));
  return {
    x: Math.min(1 - width, Math.max(0, crop.x)),
    y: Math.min(1 - height, Math.max(0, crop.y)),
    width,
    height,
  };
}
