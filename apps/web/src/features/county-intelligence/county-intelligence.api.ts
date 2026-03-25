import {
  type ApiEffectError,
  type ApiEffectSuccess,
  apiRequestJson,
  apiRequestJsonEffect,
} from "@map-migration/core-runtime/api";
import {
  buildCountyScoresCoverageRoute,
  buildCountyScoresDebugRoute,
  buildCountyScoresResolutionRoute,
  buildCountyScoresRoute,
  buildCountyScoresStatusRoute,
} from "@map-migration/http-contracts/api-routes";
import {
  type CountyScoresResponse,
  CountyScoresResponseSchema,
  type CountyScoresStatusResponse,
  CountyScoresStatusResponseSchema,
} from "@map-migration/http-contracts/county-intelligence-http";
import {
  type CountyScoresCoverageResponse,
  CountyScoresCoverageResponseSchema,
  type CountyScoresDebugResponse,
  CountyScoresDebugResponseSchema,
  type CountyScoresResolutionResponse,
  CountyScoresResolutionResponseSchema,
} from "@map-migration/http-contracts/county-intelligence-debug-http";
import type { Effect } from "effect";
import type {
  CountyScoresCoverageFetchResult,
  CountyScoresDebugFetchResult,
  CountyScoresFetchResult,
  CountyScoresResolutionFetchResult,
  CountyScoresStatusFetchResult,
} from "@/features/county-intelligence/county-intelligence.types";

export function fetchCountyScores(
  countyIds: readonly string[],
  init: RequestInit = {}
): Promise<CountyScoresFetchResult> {
  return apiRequestJson(
    buildCountyScoresRoute({
      countyIds,
    }),
    CountyScoresResponseSchema,
    init
  );
}

export function fetchCountyScoresStatus(
  init: RequestInit = {}
): Promise<CountyScoresStatusFetchResult> {
  return apiRequestJson(buildCountyScoresStatusRoute(), CountyScoresStatusResponseSchema, init);
}

export function fetchCountyScoresCoverage(
  init: RequestInit = {}
): Promise<CountyScoresCoverageFetchResult> {
  return apiRequestJson(buildCountyScoresCoverageRoute(), CountyScoresCoverageResponseSchema, init);
}

export function fetchCountyScoresResolution(
  init: RequestInit = {}
): Promise<CountyScoresResolutionFetchResult> {
  return apiRequestJson(
    buildCountyScoresResolutionRoute(),
    CountyScoresResolutionResponseSchema,
    init
  );
}

export function fetchCountyScoresDebug(
  countyIds: readonly string[],
  init: RequestInit = {}
): Promise<CountyScoresDebugFetchResult> {
  return apiRequestJson(
    buildCountyScoresDebugRoute({
      countyIds,
    }),
    CountyScoresDebugResponseSchema,
    init
  );
}

export function fetchCountyScoresEffect(
  countyIds: readonly string[],
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildCountyScoresRoute({
      countyIds,
    }),
    CountyScoresResponseSchema,
    init
  );
}

export function fetchCountyScoresStatusEffect(
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresStatusResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildCountyScoresStatusRoute(),
    CountyScoresStatusResponseSchema,
    init
  );
}

export function fetchCountyScoresCoverageEffect(
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresCoverageResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildCountyScoresCoverageRoute(),
    CountyScoresCoverageResponseSchema,
    init
  );
}

export function fetchCountyScoresResolutionEffect(
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresResolutionResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildCountyScoresResolutionRoute(),
    CountyScoresResolutionResponseSchema,
    init
  );
}

export function fetchCountyScoresDebugEffect(
  countyIds: readonly string[],
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresDebugResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildCountyScoresDebugRoute({
      countyIds,
    }),
    CountyScoresDebugResponseSchema,
    init
  );
}
