import type { HealthResponse } from "@map-migration/contracts";
import type { ApiHealthResult } from "./diagnostics.types";

export function unwrapApiHealthResult(result: ApiHealthResult): HealthResponse {
  if (!result.ok) {
    throw new Error(`health failed (${result.reason}) requestId=${result.requestId}`);
  }

  return result.data;
}
