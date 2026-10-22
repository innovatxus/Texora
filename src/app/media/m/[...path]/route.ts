import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { mediaPath } from "@/lib/merchant/media/media-service";

const SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const FILE = /^[0-9a-f-]{36}\.(webp|mp4|webm)$/;

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
  "cross-origin-resource-policy": "same-site",
};

/** Parses a single `bytes=start-end` range; null for anything else. */
function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  const match = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, from = "", to = ""] = match;
  if (from === "" && to === "") return null;
  const start = from === "" ? Math.max(0, size - Number(to)) : Number(from);
  const end = from === "" || to === "" ? size - 1 : Math.min(Number(to), size - 1);
  return start <= end && start < size ? { start, end } : null;
}

/**
 * Serves processed merchant media from the private bucket (D-064). Only
 * files the media pipeline wrote (UUID names, known types) under
 * `merchant-media/{vendor}/{shop}/media/` can be read; names are
 * unguessable and content is immutable, so it is cached for a year.
 * Range requests let videos seek.
 */
export async function GET(request: Request, { params }: RouteContext<"/media/m/[...path]">) {
  const { path } = await params;
  const [vendorId, shopId, file, ...rest] = path;
  if (!vendorId || !shopId || !file || rest.length > 0) return new Response(null, { status: 404 });
  if (!SEGMENT.test(vendorId) || !SEGMENT.test(shopId) || !FILE.test(file)) {
    return new Response(null, { status: 404 });
  }

  const object = getFirebaseAdmin()
    .storage.bucket()
    .file(mediaPath(vendorId, shopId, file));
  let metadata;
  try {
    [metadata] = await object.getMetadata();
  } catch {
    return new Response(null, { status: 404, headers: SECURITY_HEADERS });
  }
  const size = Number(metadata.size ?? 0);
  const contentType = String(metadata.contentType ?? "application/octet-stream");
  const etag = metadata.etag ? `"${metadata.etag}"` : undefined;
  if (etag && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag, ...SECURITY_HEADERS } });
  }

  const headers: Record<string, string> = {
    "content-type": contentType,
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    ...(etag ? { etag } : {}),
    ...SECURITY_HEADERS,
  };

  const range = parseRange(request.headers.get("range"), size);
  if (request.headers.get("range") && !range) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
  }
  const [data] = range
    ? await object.download({ start: range.start, end: range.end })
    : await object.download();
  if (range) {
    headers["content-range"] = `bytes ${range.start}-${range.end}/${size}`;
    headers["content-length"] = String(range.end - range.start + 1);
    return new Response(new Uint8Array(data), { status: 206, headers });
  }
  headers["content-length"] = String(size);
  return new Response(new Uint8Array(data), { status: 200, headers });
}
