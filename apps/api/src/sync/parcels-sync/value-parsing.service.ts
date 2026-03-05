export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseNullableInteger(value: unknown): number | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.floor(parsed);
}

export function parseNullableNonNegativeInteger(value: unknown): number | null {
  const parsed = parseNullableInteger(value);
  if (parsed === null || parsed < 0) {
    return null;
  }

  return parsed;
}

export function parseNullableIsoDatetime(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsedTime = Date.parse(normalized);
  if (!Number.isFinite(parsedTime)) {
    return null;
  }

  return new Date(parsedTime).toISOString();
}

export function toIsoTimestampMs(value: string | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}
