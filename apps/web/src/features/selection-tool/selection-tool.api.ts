import type { ApiEffectError, ApiEffectSuccess } from "@map-migration/core-runtime/api";
import { apiRequestJsonEffect } from "@map-migration/core-runtime/api";
import { buildMarketsSelectionRoute } from "@map-migration/http-contracts/api-routes";
import {
  type MarketSelectionResponse,
  type MarketsSelectionRequest,
  MarketsSelectionResponseSchema,
} from "@map-migration/http-contracts/markets-selection-http";
import type { Effect } from "effect";
import { buildJsonPostRequestInit } from "@/lib/api/api-request-init.service";

function buildMarketsSelectionRequestInit(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): RequestInit {
  return buildJsonPostRequestInit({
    body: request,
    signal,
  });
}

export function fetchMarketsBySelectionEffect(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): Effect.Effect<ApiEffectSuccess<MarketSelectionResponse>, ApiEffectError, never> {
  return apiRequestJsonEffect(
    buildMarketsSelectionRoute(),
    MarketsSelectionResponseSchema,
    buildMarketsSelectionRequestInit(request, signal)
  );
}
