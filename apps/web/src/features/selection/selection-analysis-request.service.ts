import { aoiBboxExceedsLimits } from "@map-migration/geo-kernel/area-of-interest-policy";
import type { BBox, PolygonGeometry } from "@map-migration/geo-kernel/geometry";

type SelectionRing = readonly [number, number][];

const SELECTION_ANALYSIS_MAX_BBOX_WIDTH_DEGREES = 2;
const SELECTION_ANALYSIS_MAX_BBOX_HEIGHT_DEGREES = 2;

export function cloneSelectionRing(selectionRing: SelectionRing): [number, number][] {
  return selectionRing.map((vertex): [number, number] => [vertex[0], vertex[1]]);
}

function closeSelectionRing(selectionRing: SelectionRing): [number, number][] {
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

export function selectionGeometryFromRing(selectionRing: SelectionRing): PolygonGeometry {
  return {
    type: "Polygon",
    coordinates: [closeSelectionRing(selectionRing)],
  };
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

  return aoiBboxExceedsLimits(bbox, {
    maxWidthDegrees: SELECTION_ANALYSIS_MAX_BBOX_WIDTH_DEGREES,
    maxHeightDegrees: SELECTION_ANALYSIS_MAX_BBOX_HEIGHT_DEGREES,
  });
}
