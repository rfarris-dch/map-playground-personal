import type { FacilitiesSelectionRequest } from "@map-migration/contracts";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";

export const FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS = parsePositiveIntFlag(
  process.env.FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  1_000_000
);

export function resolveFacilitiesSelectionGeometry(
  geometry: FacilitiesSelectionRequest["geometry"]
): { readonly geometryText: string } {
  return {
    geometryText: JSON.stringify(geometry),
  };
}
