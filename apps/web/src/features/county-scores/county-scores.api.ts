import {
  buildCountyScoresRoute,
  buildCountyScoresStatusRoute,
  type CountyScoresResponse,
  CountyScoresResponseSchema,
  type CountyScoresStatusResponse,
  CountyScoresStatusResponseSchema,
} from "@map-migration/contracts";
import {
  type ApiEffectError,
  type ApiEffectSuccess,
  apiGetJson,
  apiGetJsonEffect,
} from "@map-migration/core-runtime/api";
import type { Effect } from "effect";
import type {
  CountyScoresFetchResult,
  CountyScoresStatusFetchResult,
} from "@/features/county-scores/county-scores.types";

export function fetchCountyScores(
  countyIds: readonly string[],
  init: RequestInit = {}
): Promise<CountyScoresFetchResult> {
  return apiGetJson(
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
  return apiGetJson(buildCountyScoresStatusRoute(), CountyScoresStatusResponseSchema, init);
}

export function fetchCountyScoresEffect(
  countyIds: readonly string[],
  init: RequestInit = {}
): Effect.Effect<ApiEffectSuccess<CountyScoresResponse>, ApiEffectError, never> {
  return apiGetJsonEffect(
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
  return apiGetJsonEffect(buildCountyScoresStatusRoute(), CountyScoresStatusResponseSchema, init);
}
