type Plain = Record<string, unknown>;

function isPlainObject(value: unknown): value is Plain {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => isEqual(a[key], b[key]));
  }
  return Object.is(a, b);
}

/**
 * Dotted paths whose values differ between two documents. Nested objects are
 * walked; arrays and dates compare as whole values.
 */
export function changedPaths(before: Plain | null, after: Plain | null, prefix = ""): string[] {
  const a = before ?? {};
  const b = after ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const paths: string[] = [];

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const left = a[key];
    const right = b[key];
    if (isPlainObject(left) && isPlainObject(right)) {
      paths.push(...changedPaths(left, right, path));
    } else if (!isEqual(left, right)) {
      paths.push(path);
    }
  }
  return paths;
}
