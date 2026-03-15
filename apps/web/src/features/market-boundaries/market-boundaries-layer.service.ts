import type { MarketBoundaryFeature } from "@map-migration/http-contracts/market-boundaries-http";
import type {
  MarketBoundaryColorMode,
  MarketBoundaryFacetOption,
  MarketBoundaryHoverState,
  MarketBoundaryLayerId,
  MarketBoundaryLayerState,
} from "@/features/market-boundaries/market-boundaries.types";
import { readNullableNumberProperty, readStringProperty } from "@/lib/map-feature-readers";

export function initialMarketBoundaryLayerState(
  colorMode: MarketBoundaryColorMode = "power"
): MarketBoundaryLayerState {
  return {
    allFeatures: [],
    colorMode,
    dataLoaded: false,
    includedRegionIds: null,
    ready: false,
    requestSequence: 0,
    visible: false,
  };
}

export function isMarketBoundaryFeatureId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

export function toHoverState(
  feature: { properties: unknown },
  layerId: MarketBoundaryLayerId,
  screenPoint: readonly [number, number]
): MarketBoundaryHoverState | null {
  const regionId = readStringProperty(feature.properties, "regionId");
  const regionName = readStringProperty(feature.properties, "regionName");
  if (regionId === null || regionName === null) {
    return null;
  }

  return {
    layerId,
    regionId,
    regionName,
    parentRegionName: readStringProperty(feature.properties, "parentRegionName"),
    commissionedPowerMw: readNullableNumberProperty(feature.properties, "commissionedPowerMw"),
    absorption: readNullableNumberProperty(feature.properties, "absorption"),
    vacancy: readNullableNumberProperty(feature.properties, "vacancy"),
    screenPoint,
  };
}

export function toFacetOptions(
  features: readonly MarketBoundaryFeature[]
): MarketBoundaryFacetOption[] {
  const options = features.map((feature) => ({
    regionId: feature.properties.regionId,
    regionName: feature.properties.regionName,
    parentRegionName: feature.properties.parentRegionName,
    marketId: feature.properties.marketId,
    commissionedPowerMw: feature.properties.commissionedPowerMw,
    absorption: feature.properties.absorption,
    vacancy: feature.properties.vacancy,
  }));

  options.sort((a, b) => a.regionName.localeCompare(b.regionName));

  return options;
}

export function normalizeIncludedRegionIds(
  regionIds: readonly string[] | null
): readonly string[] | null {
  if (regionIds === null) {
    return null;
  }

  const deduped = new Set<string>();
  for (const regionId of regionIds) {
    const trimmed = regionId.trim();
    if (trimmed.length === 0) {
      continue;
    }

    deduped.add(trimmed);
  }

  return [...deduped];
}

export function areSameIncludedRegionIds(
  left: readonly string[] | null,
  right: readonly string[] | null
): boolean {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (const [index, value] of left.entries()) {
    if (value !== right[index]) {
      return false;
    }
  }

  return true;
}

export function toFilteredFeatures(
  features: readonly MarketBoundaryFeature[],
  includedRegionIds: readonly string[] | null
): readonly MarketBoundaryFeature[] {
  if (includedRegionIds === null) {
    return features;
  }

  if (includedRegionIds.length === 0) {
    return [];
  }

  const included = new Set(includedRegionIds);
  return features.filter((feature) => included.has(feature.properties.regionId));
}

export function lineWidthStops(layerId: MarketBoundaryLayerId): {
  readonly highZoom: number;
  readonly lowZoom: number;
  readonly midZoom: number;
} {
  if (layerId === "market") {
    return {
      lowZoom: 1.4,
      midZoom: 1.9,
      highZoom: 2.5,
    };
  }

  return {
    lowZoom: 0.85,
    midZoom: 1.15,
    highZoom: 1.6,
  };
}
