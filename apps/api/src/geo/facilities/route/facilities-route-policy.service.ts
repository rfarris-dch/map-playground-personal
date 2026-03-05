import type { BBox, FacilitiesSelectionRequest } from "@map-migration/contracts";
import { parsePositiveFloatFlag, parsePositiveIntFlag } from "@/config/env-parsing.service";
import { resolvePolygonBbox } from "@/http/polygon-bbox.service";

export const FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS = parsePositiveIntFlag(
  process.env.FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  1_000_000
);
export const FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES = parsePositiveFloatFlag(
  process.env.FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES,
  2
);
export const FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES = parsePositiveFloatFlag(
  process.env.FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES,
  2
);

export function facilitiesSelectionBboxExceedsLimits(bbox: BBox): boolean {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  return (
    width > FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES ||
    height > FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES
  );
}

export function resolveFacilitiesSelectionGeometry(
  geometry: FacilitiesSelectionRequest["geometry"]
): {
  readonly bbox: BBox;
  readonly geometryText: string;
} {
  return {
    bbox: resolvePolygonBbox(geometry),
    geometryText: JSON.stringify(geometry),
  };
}
