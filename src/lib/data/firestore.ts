import "server-only";
import { FieldPath, Timestamp, type DocumentSnapshot, type Query } from "firebase-admin/firestore";
import type { z } from "zod";
import { logger } from "@/lib/observability/logger";

/** Recursively converts Firestore Timestamps to Dates so Zod schemas can parse. */
export function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromFirestore(v)]));
  }
  return value;
}

export class InvalidDocumentError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: z.core.$ZodIssue[],
  ) {
    super(`Document ${path} does not match its schema`);
    this.name = "InvalidDocumentError";
  }
}

/** Parses a snapshot with its schema. Corrupt documents fail loudly instead of reaching the UI. */
export function parseSnapshot<S extends z.ZodType>(
  schema: S,
  snapshot: DocumentSnapshot,
  idField: string = "id",
): z.infer<S> | null {
  if (!snapshot.exists) return null;
  const raw = { [idField]: snapshot.id, ...(fromFirestore(snapshot.data()) as object) };
  const result = schema.safeParse(raw);
  if (!result.success) {
    logger.error("firestore.invalid_document", {
      path: snapshot.ref.path,
      issues: result.error.issues,
    });
    throw new InvalidDocumentError(snapshot.ref.path, result.error.issues);
  }
  return result.data;
}

// ------------------------------------------------------------ pagination

type CursorValue = string | number | boolean | null | { $d: number };

function encodeValue(value: unknown): CursorValue {
  if (value instanceof Timestamp) return { $d: value.toMillis() };
  if (value instanceof Date) return { $d: value.getTime() };
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return value as CursorValue;
  }
  throw new Error(`Unsupported cursor value: ${typeof value}`);
}

function decodeValue(value: CursorValue): unknown {
  return value && typeof value === "object" && "$d" in value
    ? Timestamp.fromMillis(value.$d)
    : value;
}

/** Opaque cursor: the order-by values of the last document plus its id. */
export function encodeCursor(values: readonly unknown[], id: string): string {
  return Buffer.from(JSON.stringify([...values.map(encodeValue), id])).toString("base64url");
}

export function decodeCursor(cursor: string, expectedValues: number): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(parsed) || parsed.length !== expectedValues + 1) return null;
    const id = parsed.at(-1);
    if (typeof id !== "string") return null;
    return [...(parsed.slice(0, -1) as CursorValue[]).map(decodeValue), id];
  } catch {
    return null;
  }
}

function readPath(data: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      data,
    );
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageRequest {
  limit: number;
  cursor?: string | null;
}

/**
 * Cursor pagination over a query ordered by `orderBy` fields. A document-id
 * tiebreaker is appended so pages are stable even when sort values repeat.
 */
export async function paginate<T>(
  base: Query,
  orderBy: ReadonlyArray<{ field: string; direction: "asc" | "desc" }>,
  { limit, cursor }: PageRequest,
  parse: (snapshot: DocumentSnapshot) => T | null,
): Promise<Page<T>> {
  const lastDirection = orderBy.at(-1)?.direction ?? "asc";
  let query = orderBy.reduce<Query>((q, o) => q.orderBy(o.field, o.direction), base);
  query = query.orderBy(FieldPath.documentId(), lastDirection);

  if (cursor) {
    const values = decodeCursor(cursor, orderBy.length);
    if (values) query = query.startAfter(...values);
  }

  const snapshot = await query.limit(limit + 1).get();
  const docs = snapshot.docs.slice(0, limit);
  const items = docs.map(parse).filter((item): item is T => item !== null);
  const last = docs.at(-1);
  const nextCursor =
    snapshot.docs.length > limit && last
      ? encodeCursor(
          orderBy.map((o) => readPath(last.data(), o.field)),
          last.id,
        )
      : null;

  return { items, nextCursor };
}
