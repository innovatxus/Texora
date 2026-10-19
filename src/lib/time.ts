/**
 * The current time for request-scoped server work (filters such as "new
 * arrivals"). Server Components render once per request, so reading the clock
 * here is deterministic for that render.
 */
export function requestTime(): number {
  return Date.now();
}
