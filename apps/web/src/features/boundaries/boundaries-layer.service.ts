import type { BoundaryPowerFeature } from "@map-migration/contracts";
import type {
  BoundaryFacetOption,
  BoundaryHoverState,
  BoundaryLayerId,
  BoundaryLayerState,
} from "@/features/boundaries/boundaries.types";

export const BASEMAP_BOUNDARY_LAYER_IDS: readonly string[] = [
  "boundary_2",
  "boundary_3",
  "boundary_disputed",
];

export const BASEMAP_COUNTRY_LAYER_IDS: readonly string[] = ["boundary_2", "boundary_disputed"];

export function initialBoundaryLayerState(): BoundaryLayerState {
  return {
    allFeatures: [],
    abortController: null,
    basemapLayersSuppressed: false,
    dataLoaded: false,
    hoveredFeatureId: null,
    includedRegionIds: null,
    ready: false,
    requestSequence: 0,
    visible: false,
  };
}

export function isBoundaryFeatureId(value: unknown): value is string | number {
  return typeof value === "string" || typeof value === "number";
}

function readProperty(properties: unknown, key: string): unknown {
  if (typeof properties !== "object" || properties === null) {
    return null;
  }

  return Reflect.get(properties, key);
}

function readStringProperty(properties: unknown, key: string): string | null {
  const value = readProperty(properties, key);
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readNumberProperty(properties: unknown, key: string): number | null {
  const value = readProperty(properties, key);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function toHoverState(
  feature: { properties: unknown },
  layerId: BoundaryLayerId,
  screenPoint: readonly [number, number]
): BoundaryHoverState | null {
  const regionId = readStringProperty(feature.properties, "regionId");
  const regionName = readStringProperty(feature.properties, "regionName");
  const commissionedPowerMw = readNumberProperty(feature.properties, "commissionedPowerMw");
  if (regionId === null || regionName === null || commissionedPowerMw === null) {
    return null;
  }

  return {
    boundaryId: layerId,
    regionId,
    regionName,
    parentRegionName: readStringProperty(feature.properties, "parentRegionName"),
    commissionedPowerMw,
    screenPoint,
  };
}

export function toFacetOptions(features: readonly BoundaryPowerFeature[]): BoundaryFacetOption[] {
  const options = features.map((feature) => ({
    regionId: feature.properties.regionId,
    regionName: feature.properties.regionName,
    parentRegionName: feature.properties.parentRegionName,
    commissionedPowerMw: feature.properties.commissionedPowerMw,
  }));

  options.sort((a, b) => {
    if (b.commissionedPowerMw !== a.commissionedPowerMw) {
      return b.commissionedPowerMw - a.commissionedPowerMw;
    }

    return a.regionName.localeCompare(b.regionName);
  });

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
  features: readonly BoundaryPowerFeature[],
  includedRegionIds: readonly string[] | null
): readonly BoundaryPowerFeature[] {
  if (includedRegionIds === null) {
    return features;
  }

  if (includedRegionIds.length === 0) {
    return [];
  }

  const included = new Set(includedRegionIds);
  return features.filter((feature) => included.has(feature.properties.regionId));
}

export function lineWidthStops(layerId: BoundaryLayerId): {
  readonly highZoom: number;
  readonly lowZoom: number;
  readonly midZoom: number;
} {
  if (layerId === "country") {
    return {
      lowZoom: 2.2,
      midZoom: 2.8,
      highZoom: 3.4,
    };
  }

  if (layerId === "state") {
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
