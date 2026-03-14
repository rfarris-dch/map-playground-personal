export function clampLimit(raw: string | undefined, max: number, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return defaultValue;
  }

  return Math.min(Math.floor(value), max);
}
