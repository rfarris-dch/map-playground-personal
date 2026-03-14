import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type {
  FacilitiesFeatureFilterPredicate,
  FacilitiesSourceData,
  FacilitiesStatus,
} from "@/features/facilities/facilities.types";

export function emptyFacilitiesSourceData(): FacilitiesSourceData {
  return { type: "FeatureCollection", features: [] };
}

export function facilitiesCollectionToSourceData(
  collection: FacilitiesFeatureCollection
): FacilitiesSourceData {
  return {
    type: "FeatureCollection",
    features: collection.features,
  };
}

function roundTo(value: number, decimals: number): number {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function padRange(
  min: number,
  max: number,
  paddingFactor: number
): {
  readonly max: number;
  readonly min: number;
} {
  const span = Math.max(0, max - min);
  const padding = span * paddingFactor;
  return {
    min: min - padding,
    max: max + padding,
  };
}

function floorTo(value: number, decimals: number): number {
  const precision = 10 ** decimals;
  return Math.floor(value * precision) / precision;
}

function ceilTo(value: number, decimals: number): number {
  const precision = 10 ** decimals;
  return Math.ceil(value * precision) / precision;
}

function quantizeOutwardRange(
  min: number,
  max: number,
  decimals: number
): {
  readonly max: number;
  readonly min: number;
} {
  const quantizedMin = floorTo(min, decimals);
  const quantizedMax = ceilTo(max, decimals);

  if (quantizedMin < quantizedMax) {
    return {
      min: quantizedMin,
      max: quantizedMax,
    };
  }

  const fallbackMin = roundTo(min, decimals + 2);
  const fallbackMax = roundTo(max, decimals + 2);
  if (fallbackMin < fallbackMax) {
    return {
      min: fallbackMin,
      max: fallbackMax,
    };
  }

  return {
    min,
    max,
  };
}

export function quantizeBbox(bounds: BBox, decimals = 4): BBox {
  const longitudeRange = quantizeOutwardRange(bounds.west, bounds.east, decimals);
  const latitudeRange = quantizeOutwardRange(bounds.south, bounds.north, decimals);
  const west = clamp(longitudeRange.min, -180, 180);
  const east = clamp(longitudeRange.max, -180, 180);
  const south = clamp(latitudeRange.min, -90, 90);
  const north = clamp(latitudeRange.max, -90, 90);

  return {
    east,
    north,
    south,
    west,
  };
}

export function expandBbox(bounds: BBox, paddingFactor = 0.5): BBox {
  const longitudeRange = padRange(bounds.west, bounds.east, paddingFactor);
  const latitudeRange = padRange(bounds.south, bounds.north, paddingFactor);

  return {
    west: clamp(longitudeRange.min, -180, 180),
    east: clamp(longitudeRange.max, -180, 180),
    south: clamp(latitudeRange.min, -90, 90),
    north: clamp(latitudeRange.max, -90, 90),
  };
}

export function bboxContains(container: BBox, candidate: BBox): boolean {
  return (
    container.west <= candidate.west &&
    container.south <= candidate.south &&
    container.east >= candidate.east &&
    container.north >= candidate.north
  );
}

function pointWithinBbox(coordinates: readonly [number, number], bbox: BBox): boolean {
  const [lng, lat] = coordinates;
  return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
}

export function filterFacilitiesFeaturesToBbox(
  features: FacilitiesFeatureCollection["features"],
  bbox: BBox
): FacilitiesFeatureCollection["features"] {
  return features.filter((feature) => pointWithinBbox(feature.geometry.coordinates, bbox));
}

export function applyFacilitiesFilter(
  features: FacilitiesFeatureCollection["features"],
  predicate: FacilitiesFeatureFilterPredicate | null
): FacilitiesFeatureCollection["features"] {
  if (predicate === null) {
    return features;
  }

  return features.filter(predicate);
}

export function isFeatureId(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

export function toFacilityId(featureId: number | string): string {
  return String(featureId);
}

export function hasFeatureId(
  features: FacilitiesFeatureCollection["features"],
  targetId: number | string
): boolean {
  return features.some((feature) => feature.id === targetId);
}

export function formatFacilitiesStatus(status: FacilitiesStatus): string {
  if (status.state === "idle") {
    return "Facilities: not loaded";
  }

  if (status.state === "hidden") {
    return `Facilities: hidden (zoom ${status.zoom.toFixed(2)} < ${status.minZoom})`;
  }

  if (status.state === "loading") {
    return `Facilities (${status.perspective}): loading...`;
  }

  if (status.state === "error") {
    return `Facilities (${status.perspective}): ${status.reason} (requestId=${status.requestId})`;
  }

  return `Facilities (${status.perspective}): ok (count=${status.count}, truncated=${String(
    status.truncated
  )}, requestId=${status.requestId})`;
}
