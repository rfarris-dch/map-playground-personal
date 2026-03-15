import type { MapExpression } from "@map-migration/map-engine";
import type {
  MarketBoundaryColorMode,
  MarketBoundaryFacetOption,
  MarketBoundaryLayerId,
  MarketBoundarySourceData,
} from "@/features/market-boundaries/market-boundaries.types";

export interface MarketBoundaryHeatStop {
  readonly color: string;
  readonly value: number;
}

const POWER_HEAT_STOPS: readonly MarketBoundaryHeatStop[] = [
  { value: 0, color: "#eef2ff" },
  { value: 100, color: "#c7d2fe" },
  { value: 500, color: "#a5b4fc" },
  { value: 1500, color: "#818cf8" },
  { value: 4000, color: "#6366f1" },
  { value: 10_000, color: "#4338ca" },
  { value: 25_000, color: "#312e81" },
];

const VACANCY_HEAT_STOPS: readonly MarketBoundaryHeatStop[] = [
  { value: 0, color: "#dcfce7" },
  { value: 0.05, color: "#86efac" },
  { value: 0.10, color: "#4ade80" },
  { value: 0.15, color: "#fde047" },
  { value: 0.20, color: "#fb923c" },
  { value: 0.25, color: "#f87171" },
  { value: 0.30, color: "#dc2626" },
];

const ABSORPTION_HEAT_STOPS: readonly MarketBoundaryHeatStop[] = [
  { value: -200, color: "#dc2626" },
  { value: -100, color: "#fb923c" },
  { value: 0, color: "#f5f5f4" },
  { value: 100, color: "#86efac" },
  { value: 200, color: "#22c55e" },
  { value: 500, color: "#15803d" },
];

function toInterpolationStops(stops: readonly MarketBoundaryHeatStop[]): Array<number | string> {
  const interpolationStops: Array<number | string> = [];
  for (const stop of stops) {
    interpolationStops.push(stop.value, stop.color);
  }

  return interpolationStops;
}

export function marketBoundaryLayerIds(): MarketBoundaryLayerId[] {
  return ["market", "submarket"];
}

export function marketBoundaryHeatStops(colorMode: MarketBoundaryColorMode): readonly MarketBoundaryHeatStop[] {
  if (colorMode === "vacancy") {
    return VACANCY_HEAT_STOPS;
  }

  if (colorMode === "absorption") {
    return ABSORPTION_HEAT_STOPS;
  }

  return POWER_HEAT_STOPS;
}

export function normalizeMarketBoundaryRegionIds(
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

export function reconcileMarketBoundaryFacetSelection(
  options: readonly MarketBoundaryFacetOption[],
  selectedRegionIds: readonly string[]
): readonly string[] | null {
  const availableRegionIds = new Set(options.map((option) => option.regionId));
  const nextSelection = selectedRegionIds.filter((regionId) => availableRegionIds.has(regionId));
  return nextSelection.length === options.length ? null : nextSelection;
}

export function emptyMarketBoundarySourceData(): MarketBoundarySourceData {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

function propertyKeyForColorMode(colorMode: MarketBoundaryColorMode): string {
  if (colorMode === "vacancy") {
    return "vacancy";
  }

  if (colorMode === "absorption") {
    return "absorption";
  }

  return "commissionedPowerMw";
}

function heatStopsForColorMode(colorMode: MarketBoundaryColorMode): readonly MarketBoundaryHeatStop[] {
  if (colorMode === "vacancy") {
    return VACANCY_HEAT_STOPS;
  }

  if (colorMode === "absorption") {
    return ABSORPTION_HEAT_STOPS;
  }

  return POWER_HEAT_STOPS;
}

export function marketBoundaryFillColorExpression(colorMode: MarketBoundaryColorMode): MapExpression {
  const key = propertyKeyForColorMode(colorMode);
  const stops = heatStopsForColorMode(colorMode);
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", key], 0],
    ...toInterpolationStops(stops),
  ];
}

export function marketBoundaryOutlineColorExpression(colorMode: MarketBoundaryColorMode): MapExpression {
  const key = propertyKeyForColorMode(colorMode);
  const stops = heatStopsForColorMode(colorMode);
  const outlineStops: Array<number | string> = [];
  for (const stop of stops) {
    outlineStops.push(stop.value, stop.color);
  }

  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", key], 0],
    ...outlineStops,
  ];
}

export function marketBoundaryFillOpacity(layerId: MarketBoundaryLayerId): number {
  if (layerId === "market") {
    return 0.18;
  }

  return 0.25;
}
