import { aoiBboxExceedsLimits } from "@map-migration/geo-kernel/area-of-interest-policy";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesSelectionRequest } from "@map-migration/http-contracts/facilities-http";
import { parsePositiveFloatFlag, parsePositiveIntFlag } from "@/config/env-parsing.service";
import { resolvePolygonBbox } from "@/http/polygon-bbox.service";

export const FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES = parsePositiveFloatFlag(
  process.env.FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES,
  2
);
export const FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES = parsePositiveFloatFlag(
  process.env.FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES,
  2
);

export const FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS = parsePositiveIntFlag(
  process.env.FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  1_000_000
);

export function facilitiesSelectionBboxExceedsLimits(bbox: BBox): boolean {
  return aoiBboxExceedsLimits(bbox, {
    maxHeightDegrees: FACILITIES_SELECTION_MAX_BBOX_HEIGHT_DEGREES,
    maxWidthDegrees: FACILITIES_SELECTION_MAX_BBOX_WIDTH_DEGREES,
  });
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
