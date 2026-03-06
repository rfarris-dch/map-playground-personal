import type { BBox, FacilitiesFeatureCollection } from "@map-migration/contracts";
import type {
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
