export function parsePositiveIntFlag(value: string | undefined, defaultValue: number): number {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}

export function parsePositiveFloatFlag(value: string | undefined, defaultValue: number): number {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
}
