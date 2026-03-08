import {
  buildCountyScoresRoute,
  buildCountyScoresStatusRoute,
  CountyScoresResponseSchema,
  CountyScoresStatusResponseSchema,
} from "@map-migration/contracts";
import type {
  CountyScoresFetchResult,
  CountyScoresStatusFetchResult,
} from "@/features/county-scores/county-scores.types";
import { apiGetJson } from "@/lib/api-client";
import { apiGetJsonEffect } from "@/lib/api-client-effect";

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

export function fetchCountyScoresEffect(countyIds: readonly string[], init: RequestInit = {}) {
  return apiGetJsonEffect(
    buildCountyScoresRoute({
      countyIds,
    }),
    CountyScoresResponseSchema,
    init
  );
}

export function fetchCountyScoresStatusEffect(init: RequestInit = {}) {
  return apiGetJsonEffect(buildCountyScoresStatusRoute(), CountyScoresStatusResponseSchema, init);
}
