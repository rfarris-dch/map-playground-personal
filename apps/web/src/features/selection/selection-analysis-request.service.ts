import type { FacilitiesSelectionRequest, ParcelEnrichRequest } from "@map-migration/contracts";

type SelectionRing = readonly [number, number][];

interface SelectionApiFailure {
  readonly code?: string;
  readonly details?: unknown;
  readonly message?: string;
  readonly reason: string;
  readonly status?: number;
}

export function cloneSelectionRing(selectionRing: SelectionRing): [number, number][] {
  return selectionRing.map((vertex): [number, number] => [vertex[0], vertex[1]]);
}

export function closeSelectionRing(selectionRing: SelectionRing): [number, number][] {
  const ring = cloneSelectionRing(selectionRing);
  if (ring.length === 0) {
    return ring;
  }

  const firstVertex = ring[0];
  const lastVertex = ring.at(-1);
  if (!(firstVertex && lastVertex)) {
    return ring;
  }

  if (firstVertex[0] === lastVertex[0] && firstVertex[1] === lastVertex[1]) {
    return ring;
  }

  ring.push([firstVertex[0], firstVertex[1]]);
  return ring;
}

export function selectionGeometryFromRing(
  selectionRing: SelectionRing
): FacilitiesSelectionRequest["geometry"] {
  return {
    type: "Polygon",
    coordinates: [closeSelectionRing(selectionRing)],
  };
}

export function selectionAoiFromRing(selectionRing: SelectionRing): ParcelEnrichRequest["aoi"] {
  return {
    type: "polygon",
    geometry: selectionGeometryFromRing(selectionRing),
  };
}

function describeSelectionApiFailure(result: SelectionApiFailure): string {
  if (typeof result.message === "string" && result.message.trim().length > 0) {
    return result.message;
  }

  if (result.reason === "network") {
    return "network request failed";
  }

  if (result.reason === "schema") {
    return "response schema validation failed";
  }

  if (typeof result.status === "number") {
    return `HTTP ${String(result.status)}`;
  }

  if (typeof result.code === "string" && result.code.trim().length > 0) {
    return result.code;
  }

  return result.reason;
}

export function formatSelectionApiFailure(queryLabel: string, result: SelectionApiFailure): string {
  return `${queryLabel} query failed (${describeSelectionApiFailure(result)}).`;
}
