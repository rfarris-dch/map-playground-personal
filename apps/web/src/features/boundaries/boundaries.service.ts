import type { MapExpression } from "@map-migration/map-engine";
import type {
  BoundaryFacetOption,
  BoundaryLayerId,
  BoundarySourceData,
} from "@/features/boundaries/boundaries.types";
import type { BoundaryHeatStop } from "./boundaries.service.types";

export type { BoundaryHeatStop } from "./boundaries.service.types";

const BOUNDARY_HEAT_STOPS: readonly BoundaryHeatStop[] = [
  { value: 0, color: "#eef2ff" },
  { value: 100, color: "#c7d2fe" },
  { value: 500, color: "#a5b4fc" },
  { value: 1500, color: "#818cf8" },
  { value: 4000, color: "#6366f1" },
  { value: 10_000, color: "#4338ca" },
  { value: 25_000, color: "#312e81" },
];

function toInterpolationStops(stops: readonly BoundaryHeatStop[]): Array<number | string> {
  const interpolationStops: Array<number | string> = [];
  for (const stop of stops) {
    interpolationStops.push(stop.value, stop.color);
  }

  return interpolationStops;
}

const BOUNDARY_HEAT_INTERPOLATION_STOPS = toInterpolationStops(BOUNDARY_HEAT_STOPS);

export function boundaryLayerIds(): BoundaryLayerId[] {
  return ["county", "state", "country"];
}

export function normalizeBoundaryRegionIds(
  regionIds: readonly string[] | null
): readonly string[] | null {
  if (regionIds === null) {
    return null;
  }

  const deduped = new Set<string>();
  for (const regionId of regionIds) {
    const normalizedRegionId = regionId.trim();
    if (normalizedRegionId.length === 0) {
      continue;
    }

    deduped.add(normalizedRegionId);
  }

  return [...deduped];
}

export function reconcileBoundaryFacetSelection(
  options: readonly BoundaryFacetOption[],
  selectedRegionIds: readonly string[]
): readonly string[] | null {
  const availableRegionIds = new Set(options.map((option) => option.regionId));
  const nextSelection = selectedRegionIds.filter((regionId) => availableRegionIds.has(regionId));
  return nextSelection.length === options.length ? null : nextSelection;
}

export function boundaryHeatStops(): readonly BoundaryHeatStop[] {
  return BOUNDARY_HEAT_STOPS;
}

export function emptyBoundarySourceData(): BoundarySourceData {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function boundaryFillColorExpression(): MapExpression {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "commissionedPowerMw"], 0],
    ...BOUNDARY_HEAT_INTERPOLATION_STOPS,
  ];
}

export function boundaryOutlineColorExpression(): MapExpression {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "commissionedPowerMw"], 0],
    0,
    "#94a3b8",
    500,
    "#6366f1",
    5000,
    "#4338ca",
    25_000,
    "#1e1b4b",
  ];
}

export function boundaryFillOpacity(layerId: BoundaryLayerId): number {
  if (layerId === "country") {
    return 0.32;
  }

  if (layerId === "state") {
    return 0.24;
  }

  return 0.12;
}
