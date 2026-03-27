function normalizeCliArgName(name: string): string {
  return name.startsWith("--") ? name : `--${name}`;
}

export function findCliArgValue(argv: readonly string[], name: string): string | null {
  const normalizedName = normalizeCliArgName(name);
  const prefix = `${normalizedName}=`;

  for (const [index, raw] of argv.entries()) {
    if (raw.startsWith(prefix)) {
      return raw.slice(prefix.length);
    }

    if (raw === normalizedName) {
      const next = argv[index + 1];
      if (typeof next === "string" && !next.startsWith("--")) {
        return next;
      }
    }
  }

  return null;
}

export function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }

  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes") {
    return true;
  }

  return defaultValue;
}

export function parseIntervalMilliseconds(
  value: string | undefined,
  defaultSeconds: number
): number {
  if (!value) {
    return defaultSeconds * 1000;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultSeconds * 1000;
  }

  return Math.floor(parsed * 1000);
}
