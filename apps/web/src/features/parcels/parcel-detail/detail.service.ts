import type {
  ParcelDetailPayload,
  ParcelDetailResult,
} from "@/features/parcels/parcel-detail/detail.types";
import type { ParcelAttributeEntry } from "./detail.service.types";

function formatUnknownValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

export function unwrapParcelDetailResult(result: ParcelDetailResult): ParcelDetailPayload {
  if (!result.ok) {
    throw new Error(`parcel detail failed (${result.reason}) requestId=${result.requestId}`);
  }

  return {
    requestId: result.requestId,
    response: result.data,
  };
}

export function toParcelAttributeEntries(
  attrs: Readonly<Record<string, unknown>>
): readonly ParcelAttributeEntry[] {
  const entries: ParcelAttributeEntry[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    entries.push({
      key,
      value: formatUnknownValue(value),
    });
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));
  return entries;
}
