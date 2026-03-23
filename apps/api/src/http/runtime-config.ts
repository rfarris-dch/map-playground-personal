import { type SourceMode, SourceModeSchema } from "@map-migration/http-contracts/api-response-meta";
import { ApiDefaults, resolveDataVersion } from "@map-migration/http-contracts/api-routes";
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

function readOptionalText(
  env: Readonly<Record<string, string | undefined>>,
  envKey: string
): string | null {
  const raw = env[envKey];
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  return normalized.length > 0 ? normalized : null;
}

function createApiRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>
): ApiRuntimeConfig {
  const analysisSummarySourceMode = readSourceMode(
    env,
    "ANALYSIS_SUMMARY_SOURCE_MODE",
    ApiDefaults.analysisSummarySourceMode
  );
  const boundariesSourceMode = readSourceMode(
    env,
    "BOUNDARIES_SOURCE_MODE",
    ApiDefaults.boundariesSourceMode
  );
  const countyIntelligenceSourceMode = readSourceMode(
    env,
    "COUNTY_INTELLIGENCE_SOURCE_MODE",
    ApiDefaults.countyIntelligenceSourceMode
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
  const marketBoundariesSourceMode = readSourceMode(
    env,
    "MARKET_BOUNDARIES_SOURCE_MODE",
    ApiDefaults.marketBoundariesSourceMode
  );
  const marketsSourceMode = readSourceMode(
    env,
    "MARKETS_SOURCE_MODE",
    ApiDefaults.marketsSourceMode
  );
  const dataVersion = resolveDataVersion({
    env,
    fallback: ApiDefaults.dataVersion,
  });
  const facilitiesDatasetVersion = resolveDataVersion({
    env: {
      ...env,
      API_DATA_VERSION: env.API_FACILITIES_DATASET_VERSION,
      DATA_VERSION: env.FACILITIES_DATASET_VERSION,
      GIT_SHA: undefined,
      MAP_DATA_VERSION: env.MAP_FACILITIES_DATASET_VERSION,
    },
    fallback: dataVersion,
  });

  assertPostgisServingMode("ANALYSIS_SUMMARY_SOURCE_MODE", analysisSummarySourceMode);
  assertPostgisServingMode("BOUNDARIES_SOURCE_MODE", boundariesSourceMode);
  assertPostgisServingMode("COUNTY_INTELLIGENCE_SOURCE_MODE", countyIntelligenceSourceMode);
  assertPostgisServingMode("FACILITIES_SOURCE_MODE", facilitiesSourceMode);
  assertPostgisServingMode("MARKET_BOUNDARIES_SOURCE_MODE", marketBoundariesSourceMode);
  assertPostgisServingMode("MARKETS_SOURCE_MODE", marketsSourceMode);
  assertPostgisServingMode("PARCELS_SOURCE_MODE", parcelsSourceMode);
  assertExternalXyzServingMode("FIBER_LOCATOR_SOURCE_MODE", fiberLocatorSourceMode);

  return Object.freeze<ApiRuntimeConfig>({
    analysisSummarySourceMode,
    boundariesSourceMode,
    countyIntelligenceSourceMode,
    dataVersion,
    facilitiesDatasetPreviousVersion: readOptionalText(
      env,
      "API_FACILITIES_DATASET_PREVIOUS_VERSION"
    ),
    facilitiesDatasetPublishedAt:
      readOptionalText(env, "API_FACILITIES_DATASET_PUBLISHED_AT") ?? new Date().toISOString(),
    facilitiesDatasetVersion,
    facilitiesSourceMode,
    facilitiesWarmProfileVersion: readOptionalText(env, "API_FACILITIES_WARM_PROFILE_VERSION"),
    fiberLocatorSourceMode,
    marketBoundariesSourceMode,
    marketsSourceMode,
    parcelsSourceMode,
  });
}

const runtimeConfig = createApiRuntimeConfig(process.env);

export function getApiRuntimeConfig(): ApiRuntimeConfig {
  return runtimeConfig;
}
