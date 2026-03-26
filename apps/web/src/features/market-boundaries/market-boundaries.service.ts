import type { MapExpression } from "@map-migration/map-engine";
import type {
  MarketBoundaryColorMode,
  MarketBoundaryFacetOption,
  MarketBoundaryLayerId,
  MarketBoundarySourceData,
} from "@/features/market-boundaries/market-boundaries.types";

interface MarketBoundaryHeatStop {
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
  { value: 0.1, color: "#4ade80" },
  { value: 0.15, color: "#fde047" },
  { value: 0.2, color: "#fb923c" },
  { value: 0.25, color: "#f87171" },
  { value: 0.3, color: "#dc2626" },
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

function heatStopsForColorMode(
  colorMode: MarketBoundaryColorMode
): readonly MarketBoundaryHeatStop[] {
  if (colorMode === "vacancy") {
    return VACANCY_HEAT_STOPS;
  }

  if (colorMode === "absorption") {
    return ABSORPTION_HEAT_STOPS;
  }

  return POWER_HEAT_STOPS;
}

const SUBMARKET_CATEGORY_COLORS: readonly string[] = [
  "#6366f1", // indigo
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#e879f9", // fuchsia
  "#a855f7", // purple
  "#22d3ee", // sky
  "#facc15", // yellow
  "#fb7185", // rose
  "#34d399", // emerald-light
  "#818cf8", // indigo-light
  "#fbbf24", // amber-light
  "#38bdf8", // sky-light
  "#c084fc", // purple-light
  "#2dd4bf", // teal-light
  "#fb923c", // orange-light
  "#a3e635", // lime-light
  "#f472b6", // pink-light
];

export function buildSubmarketCategoryColorExpression(
  features: readonly { properties: { regionId: string } }[]
): MapExpression {
  const regionIds = [...new Set(features.map((f) => f.properties.regionId))].sort();

  if (regionIds.length === 0) {
    return "#94a3b8" as unknown as MapExpression;
  }

  const cases: string[] = [];
  for (const [index, regionId] of regionIds.entries()) {
    const color = SUBMARKET_CATEGORY_COLORS[index % SUBMARKET_CATEGORY_COLORS.length] ?? "#94a3b8";
    cases.push(regionId, color);
  }

  return ["match", ["get", "regionId"], ...cases, "#94a3b8"] as unknown as MapExpression;
}

export function marketBoundaryFillColorExpression(
  colorMode: MarketBoundaryColorMode
): MapExpression {
  const key = propertyKeyForColorMode(colorMode);
  const stops = heatStopsForColorMode(colorMode);
  return ["interpolate", ["linear"], ["coalesce", ["get", key], 0], ...toInterpolationStops(stops)];
}

export function marketBoundaryOutlineColorExpression(
  colorMode: MarketBoundaryColorMode
): MapExpression {
  const key = propertyKeyForColorMode(colorMode);
  const stops = heatStopsForColorMode(colorMode);
  const outlineStops: Array<number | string> = [];
  for (const stop of stops) {
    outlineStops.push(stop.value, stop.color);
  }

  return ["interpolate", ["linear"], ["coalesce", ["get", key], 0], ...outlineStops];
}

export function marketBoundaryFillOpacity(layerId: MarketBoundaryLayerId): number {
  if (layerId === "market") {
    return 0.65;
  }

  return 0.7;
}
