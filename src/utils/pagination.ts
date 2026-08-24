const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Parses a `limit` query param into a safe positive integer. Falls back to
 * the default for anything missing, non-numeric, non-positive, or
 * non-integer, and caps absurdly large values so a client can't force an
 * unbounded table scan.
 */
export function parseLimit(
  raw: unknown,
  defaultLimit = DEFAULT_LIMIT,
  maxLimit = MAX_LIMIT
): number {
  if (typeof raw !== "string") return defaultLimit;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultLimit;
  }
  return Math.min(parsed, maxLimit);
}
