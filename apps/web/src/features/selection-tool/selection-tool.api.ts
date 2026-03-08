import {
  buildMarketsSelectionRoute,
  type MarketsSelectionRequest,
  MarketsSelectionResponseSchema,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";
import { apiGetJson } from "@/lib/api-client";

type MarketsSelectionResult = ApiResult<typeof MarketsSelectionResponseSchema._type>;

export function fetchMarketsBySelection(
  request: MarketsSelectionRequest,
  signal?: AbortSignal
): Promise<MarketsSelectionResult> {
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(request),
  };

  if (signal) {
    requestInit.signal = signal;
  }

  return apiGetJson(buildMarketsSelectionRoute(), MarketsSelectionResponseSchema, requestInit);
}
