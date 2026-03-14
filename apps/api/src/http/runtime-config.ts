import { ApiDefaults, resolveDataVersion } from "@map-migration/http-contracts/api-routes";
import { type SourceMode, SourceModeSchema } from "@map-migration/http-contracts/api-response-meta";
import type { ApiRuntimeConfig } from "./runtime-config.types";

function assertPostgisServingMode(envKey: string, mode: SourceMode): void {
  if (mode === "postgis") {
    return;
  }

  throw new Error(`[api] ${envKey} must be "postgis" for this API build (received "${mode}")`);
}

function assertExternalXyzServingMode(envKey: string, mode: SourceMode): void {
  if (mode === "external-xyz") {
    return;
  }

  throw new Error(`[api] ${envKey} must be "external-xyz" for this API build (received "${mode}")`);
}

function readSourceMode(
  env: Readonly<Record<string, string | undefined>>,
  envKey: string,
  fallback: SourceMode
): SourceMode {
  const raw = env[envKey];
  if (typeof raw !== "string") {
    return fallback;
  }

  const normalized = raw.trim();
  if (normalized.length === 0) {
    return fallback;
  }

  const parsed = SourceModeSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error(`Invalid ${envKey} value: ${normalized}`);
  }

  return parsed.data;
}

function createApiRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>
): ApiRuntimeConfig {
  const boundariesSourceMode = readSourceMode(
    env,
    "BOUNDARIES_SOURCE_MODE",
    ApiDefaults.boundariesSourceMode
  );
  const facilitiesSourceMode = readSourceMode(
    env,
    "FACILITIES_SOURCE_MODE",
    ApiDefaults.facilitiesSourceMode
  );
  const parcelsSourceMode = readSourceMode(
    env,
    "PARCELS_SOURCE_MODE",
    ApiDefaults.parcelsSourceMode
  );
  const fiberLocatorSourceMode = readSourceMode(
    env,
    "FIBER_LOCATOR_SOURCE_MODE",
    ApiDefaults.fiberLocatorSourceMode
  );

  assertPostgisServingMode("BOUNDARIES_SOURCE_MODE", boundariesSourceMode);
  assertPostgisServingMode("FACILITIES_SOURCE_MODE", facilitiesSourceMode);
  assertPostgisServingMode("PARCELS_SOURCE_MODE", parcelsSourceMode);
  assertExternalXyzServingMode("FIBER_LOCATOR_SOURCE_MODE", fiberLocatorSourceMode);

  return Object.freeze<ApiRuntimeConfig>({
    boundariesSourceMode,
    dataVersion: resolveDataVersion({
      env,
      fallback: ApiDefaults.dataVersion,
    }),
    facilitiesSourceMode,
    fiberLocatorSourceMode,
    parcelsSourceMode,
  });
}

const runtimeConfig = createApiRuntimeConfig(process.env);

export function getApiRuntimeConfig(): ApiRuntimeConfig {
  return runtimeConfig;
}
