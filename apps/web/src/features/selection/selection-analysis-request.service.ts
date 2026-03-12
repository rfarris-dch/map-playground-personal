import type {
  BBox,
  FacilitiesSelectionRequest,
  ParcelEnrichRequest,
} from "@map-migration/contracts";

type SelectionRing = readonly [number, number][];

const SELECTION_ANALYSIS_MAX_BBOX_WIDTH_DEGREES = 2;
const SELECTION_ANALYSIS_MAX_BBOX_HEIGHT_DEGREES = 2;

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

function normalizeEastLongitude(west: number, east: number): number {
  if (east >= west) {
    return east;
  }

  return east + 360;
}

export function buildSelectionRingBbox(selectionRing: SelectionRing): BBox | null {
  const firstVertex = selectionRing[0];
  if (typeof firstVertex === "undefined") {
    return null;
  }

  let west = firstVertex[0];
  let east = firstVertex[0];
  let south = firstVertex[1];
  let north = firstVertex[1];

  for (const [longitude, latitude] of selectionRing) {
    west = Math.min(west, longitude);
    east = Math.max(east, longitude);
    south = Math.min(south, latitude);
    north = Math.max(north, latitude);
  }

  return {
    west,
    south,
    east,
    north,
  };
}

export function selectionRingExceedsFastAnalysisLimits(selectionRing: SelectionRing): boolean {
  const bbox = buildSelectionRingBbox(selectionRing);
  if (bbox === null) {
    return false;
  }

  const width = normalizeEastLongitude(bbox.west, bbox.east) - bbox.west;
  const height = bbox.north - bbox.south;

  return (
    width > SELECTION_ANALYSIS_MAX_BBOX_WIDTH_DEGREES ||
    height > SELECTION_ANALYSIS_MAX_BBOX_HEIGHT_DEGREES
  );
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
