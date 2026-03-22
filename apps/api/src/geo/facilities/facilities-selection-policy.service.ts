import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesSelectionRequest } from "@map-migration/http-contracts/facilities-http";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import { resolvePolygonBbox } from "@/http/polygon-bbox.service";

export const FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS = parsePositiveIntFlag(
  process.env.FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  1_000_000
);

export function facilitiesSelectionBboxExceedsLimits(_bbox: BBox): boolean {
  return false;
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
