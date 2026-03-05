export function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes") {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }

  return defaultValue;
}

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

export function parseIntervalSecondsAsMs(
  value: string | undefined,
  defaultSeconds: number
): number {
  const seconds = parsePositiveFloatFlag(value, defaultSeconds);
  return Math.floor(seconds * 1000);
}
