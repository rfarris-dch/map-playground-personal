export function parseIsoToTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

export function parseNullableIsoToTimestamp(value: string | null): number | null {
  if (typeof value !== "string") {
    return null;
  }

  return parseIsoToTimestamp(value);
}
