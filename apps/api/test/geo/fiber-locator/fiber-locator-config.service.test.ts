import { afterEach, describe, expect, it } from "bun:test";
import type { FiberLocatorConfigDefaults } from "@/geo/fiber-locator/fiber-locator-config.service";
import { readFiberLocatorConfig } from "@/geo/fiber-locator/fiber-locator-config.service";

const defaults: FiberLocatorConfigDefaults = {
  requestTimeoutMs: 30_000,
  tileCacheMaxEntries: 512,
  tileCacheTtlMs: 15_000,
};

const FIBER_ENV_KEYS: readonly string[] = [
  "FIBERLOCATOR_API_BASE_URL",
  "FIBERLOCATOR_LINE_IDS",
  "FIBERLOCATOR_REQUEST_TIMEOUT_MS",
  "FIBERLOCATOR_STATIC_TOKEN",
  "FIBERLOCATOR_TILE_CACHE_MAX_ENTRIES",
  "FIBERLOCATOR_TILE_CACHE_TTL_MS",
];

const originalEnvEntries = new Map<string, string | undefined>(
  FIBER_ENV_KEYS.map((key) => [key, process.env[key]])
);

function restoreFiberEnv(): void {
  for (const [key, value] of originalEnvEntries) {
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
}

function setFiberEnv(values: Partial<Record<string, string | undefined>>): void {
  restoreFiberEnv();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
}

describe("fiber-locator-config.service", () => {
  afterEach(() => {
    restoreFiberEnv();
  });

  it("requires the deployed fiber locator upstream contract", () => {
    setFiberEnv({
      FIBERLOCATOR_API_BASE_URL: "https://fiberlocator.example.com",
      FIBERLOCATOR_LINE_IDS: "metro,longhaul",
      FIBERLOCATOR_STATIC_TOKEN: undefined,
    });

    expect(() => readFiberLocatorConfig(defaults)).toThrow("FIBERLOCATOR_STATIC_TOKEN is required");
  });

  it("normalizes the configured fiber locator values", () => {
    setFiberEnv({
      FIBERLOCATOR_API_BASE_URL: "https://fiberlocator.example.com/",
      FIBERLOCATOR_LINE_IDS: "Metro, longhaul, metro",
      FIBERLOCATOR_REQUEST_TIMEOUT_MS: "45000",
      FIBERLOCATOR_STATIC_TOKEN: " token-value ",
      FIBERLOCATOR_TILE_CACHE_MAX_ENTRIES: "250",
      FIBERLOCATOR_TILE_CACHE_TTL_MS: "60000",
    });

    expect(readFiberLocatorConfig(defaults)).toEqual({
      apiBaseUrl: "https://fiberlocator.example.com",
      lineIds: ["metro", "longhaul"],
      requestTimeoutMs: 45_000,
      staticToken: "token-value",
      tileCacheMaxEntries: 250,
      tileCacheTtlMs: 60_000,
    });
  });
});
