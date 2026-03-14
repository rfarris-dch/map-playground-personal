import { buildMarketsSelectionRoute, type MarketsSelectionRequest, MarketsSelectionResponseSchema } from "@map-migration/http-contracts";
import type { ApiEffectError, ApiEffectSuccess, ApiResult } from "@map-migration/core-runtime/api";
import { apiGetJson, apiGetJsonEffect } from "@map-migration/core-runtime/api";
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
  return apiGetJson(
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
  return apiGetJsonEffect(
    buildMarketsSelectionRoute(),
    MarketsSelectionResponseSchema,
    buildMarketsSelectionRequestInit(request, signal)
  );
}
