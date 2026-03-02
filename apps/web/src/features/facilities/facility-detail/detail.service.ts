import type { FacilityDetailPayload, FacilityDetailResult } from "./detail.types";

export function unwrapFacilityDetailResult(result: FacilityDetailResult): FacilityDetailPayload {
  if (!result.ok) {
    throw new Error(`facility detail failed (${result.reason}) requestId=${result.requestId}`);
  }

  return {
    requestId: result.requestId,
    response: result.data,
  };
}

export function formatNullableMw(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return `${value.toLocaleString()} MW`;
}
