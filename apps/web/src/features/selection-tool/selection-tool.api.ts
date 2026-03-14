import type { ApiEffectError, ApiEffectSuccess, ApiResult } from "@map-migration/core-runtime/api";
import { apiRequestJson, apiRequestJsonEffect } from "@map-migration/core-runtime/api";
import { buildMarketsSelectionRoute } from "@map-migration/http-contracts/api-routes";
import {
  type MarketsSelectionRequest,
  MarketsSelectionResponseSchema,
} from "@map-migration/http-contracts/markets-selection-http";
import type { Effect } from "effect";
import { buildJsonPostRequestInit } from "@/lib/api/api-request-init.service";

type MarketsSelectionResult = ApiResult<typeof MarketsSelectionResponseSchema._type>;

function buildMarketsSelectionRequestInit(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): RequestInit {
  return buildJsonPostRequestInit({
    body: request,
    signal,
  });
}

export function fetchMarketsBySelection(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): Promise<MarketsSelectionResult> {
  return apiRequestJson(
    buildMarketsSelectionRoute(),
    MarketsSelectionResponseSchema,
    buildMarketsSelectionRequestInit(request, signal)
  );
}

export function fetchMarketsBySelectionEffect(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): Effect.Effect<
  ApiEffectSuccess<typeof MarketsSelectionResponseSchema._type>,
  ApiEffectError,
  never
> {
  return apiRequestJsonEffect(
    buildMarketsSelectionRoute(),
    MarketsSelectionResponseSchema,
    buildMarketsSelectionRequestInit(request, signal)
  );
}
