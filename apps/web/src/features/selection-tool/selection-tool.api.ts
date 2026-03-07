import {
  buildMarketsSelectionRoute,
  MarketsSelectionResponseSchema,
} from "@map-migration/contracts";
import type {
  MarketsSelectionRequestInput,
  MarketsSelectionResult,
} from "@/features/selection-tool/selection-tool.types";
import { apiGetJson } from "@/lib/api-client";

export function fetchMarketsBySelection(
  request: MarketsSelectionRequestInput,
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
