import type { FiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator.types";
import type { FiberLocatorConfigDefaults } from "./fiber-locator-config.service.types";

export type { FiberLocatorConfigDefaults } from "./fiber-locator-config.service.types";

function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function parsePositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (typeof raw !== "string") {
    return defaultValue;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}

function parseLineIds(raw: string | undefined): readonly string[] {
  if (typeof raw !== "string") {
    throw new Error("FIBERLOCATOR_LINE_IDS is required (comma-separated layer ids)");
  }

  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.toLowerCase());

  const deduped = values.reduce<{ readonly seen: Set<string>; readonly values: string[] }>(
    (state, value) => {
      if (!state.seen.has(value)) {
        state.seen.add(value);
        state.values.push(value);
      }

      return state;
    },
    {
      seen: new Set<string>(),
      values: [],
    }
  ).values;

  if (deduped.length === 0) {
    throw new Error("FIBERLOCATOR_LINE_IDS must include at least one layer id");
  }

  return deduped;
}

export function readFiberLocatorConfig(defaults: FiberLocatorConfigDefaults): FiberLocatorConfig {
  const apiBaseUrl = process.env.FIBERLOCATOR_API_BASE_URL;
  const staticToken = process.env.FIBERLOCATOR_STATIC_TOKEN;

  if (typeof apiBaseUrl !== "string" || apiBaseUrl.trim().length === 0) {
    throw new Error("FIBERLOCATOR_API_BASE_URL is required");
  }

  if (typeof staticToken !== "string" || staticToken.trim().length === 0) {
    throw new Error("FIBERLOCATOR_STATIC_TOKEN is required");
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
    requestTimeoutMs: parsePositiveIntEnv(
      "FIBERLOCATOR_REQUEST_TIMEOUT_MS",
      defaults.requestTimeoutMs
    ),
    lineIds: parseLineIds(process.env.FIBERLOCATOR_LINE_IDS),
    staticToken: staticToken.trim(),
    tileCacheMaxEntries: parsePositiveIntEnv(
      "FIBERLOCATOR_TILE_CACHE_MAX_ENTRIES",
      defaults.tileCacheMaxEntries
    ),
    tileCacheTtlMs: parsePositiveIntEnv("FIBERLOCATOR_TILE_CACHE_TTL_MS", defaults.tileCacheTtlMs),
  };
}
