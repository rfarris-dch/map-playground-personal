import type { BBox } from "@map-migration/geo-kernel/geometry";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type {
  FacilitiesFeatureFilterPredicate,
  FacilitiesGuardrailResult,
  FacilitiesSourceData,
  FacilitiesStatus,
} from "@/features/facilities/facilities.types";

export interface FacilitiesBboxCacheEntry {
  readonly bbox: BBox;
  readonly features: FacilitiesFeatureCollection["features"];
  readonly requestId: string;
  readonly truncated: boolean;
}

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

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(latA: number, lonA: number, latB: number, lonB: number): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(latB - latA);
  const deltaLon = toRadians(lonB - lonA);
  const latARadians = toRadians(latA);
  const latBRadians = toRadians(latB);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const a = sinLat * sinLat + Math.cos(latARadians) * Math.cos(latBRadians) * sinLon * sinLon;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function normalizeEastLongitude(west: number, east: number): number {
  if (east >= west) {
    return east;
  }

  return east + 360;
}

function getLongitudeIntervals(bbox: BBox): readonly [
  Readonly<{
    readonly east: number;
    readonly west: number;
  }>,
  ...ReadonlyArray<{
    readonly east: number;
    readonly west: number;
  }>,
] {
  if (bbox.east >= bbox.west) {
    return [{ west: bbox.west, east: bbox.east }];
  }

  return [
    { west: bbox.west, east: 180 },
    { west: -180, east: bbox.east },
  ];
}

function estimateViewportWidthKm(bounds: BBox): number {
  const midpointLatitude = (bounds.north + bounds.south) / 2;
  const eastLongitude = normalizeEastLongitude(bounds.west, bounds.east);
  return haversineDistanceKm(midpointLatitude, bounds.west, midpointLatitude, eastLongitude);
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

export function evaluateFacilitiesGuardrails(args: {
  readonly bounds: BBox;
  readonly isStressBlocked: boolean;
  readonly maxViewportWidthKm: number;
}): FacilitiesGuardrailResult {
  const viewportWidthKm = estimateViewportWidthKm(args.bounds);

  if (args.isStressBlocked) {
    return {
      blocked: true,
      reason: "stress",
      viewportWidthKm,
    };
  }

  if (viewportWidthKm > args.maxViewportWidthKm) {
    return {
      blocked: true,
      reason: "viewport-span",
      viewportWidthKm,
    };
  }

  return {
    blocked: false,
    reason: null,
    viewportWidthKm,
  };
}

export function bboxContains(container: BBox, candidate: BBox): boolean {
  if (container.south > candidate.south || container.north < candidate.north) {
    return false;
  }

  const containerIntervals = getLongitudeIntervals(container);
  const candidateIntervals = getLongitudeIntervals(candidate);

  return candidateIntervals.every((candidateInterval) =>
    containerIntervals.some(
      (containerInterval) =>
        containerInterval.west <= candidateInterval.west &&
        containerInterval.east >= candidateInterval.east
    )
  );
}

function bboxEquals(left: BBox, right: BBox): boolean {
  return (
    left.west === right.west &&
    left.south === right.south &&
    left.east === right.east &&
    left.north === right.north
  );
}

function bboxArea(bbox: BBox): number {
  return (
    Math.max(0, normalizeEastLongitude(bbox.west, bbox.east) - bbox.west) *
    Math.max(0, bbox.north - bbox.south)
  );
}

export function findFacilitiesBboxCacheEntry(
  entries: readonly FacilitiesBboxCacheEntry[],
  bbox: BBox
): FacilitiesBboxCacheEntry | null {
  let bestContainingEntry: FacilitiesBboxCacheEntry | null = null;

  for (const entry of entries) {
    if (bboxEquals(entry.bbox, bbox)) {
      return entry;
    }

    if (entry.truncated || !bboxContains(entry.bbox, bbox)) {
      continue;
    }

    if (bestContainingEntry === null || bboxArea(entry.bbox) < bboxArea(bestContainingEntry.bbox)) {
      bestContainingEntry = entry;
    }
  }

  return bestContainingEntry;
}

export function upsertFacilitiesBboxCacheEntry(
  entries: readonly FacilitiesBboxCacheEntry[],
  nextEntry: FacilitiesBboxCacheEntry,
  maxEntries = 4
): readonly FacilitiesBboxCacheEntry[] {
  const nextEntries = [nextEntry];

  for (const entry of entries) {
    if (bboxEquals(entry.bbox, nextEntry.bbox)) {
      continue;
    }

    nextEntries.push(entry);
    if (nextEntries.length >= maxEntries) {
      break;
    }
  }

  return nextEntries;
}

function pointWithinBbox(coordinates: readonly [number, number], bbox: BBox): boolean {
  const [lng, lat] = coordinates;
  if (!(lat >= bbox.south && lat <= bbox.north)) {
    return false;
  }

  return getLongitudeIntervals(bbox).some(
    (interval) => lng >= interval.west && lng <= interval.east
  );
}

export function filterFacilitiesFeaturesToBbox(
  features: FacilitiesFeatureCollection["features"],
  bbox: BBox
): FacilitiesFeatureCollection["features"] {
  return features.filter((feature) => {
    if (feature.geometry.type !== "Point") {
      return false;
    }
    return pointWithinBbox(feature.geometry.coordinates, bbox);
  });
}

export function filterFacilitiesFeaturesToViewport(args: {
  readonly canvasSize: {
    readonly height: number;
    readonly width: number;
  };
  readonly features: FacilitiesFeatureCollection["features"];
  readonly projectPoint: (coordinates: readonly [number, number]) => readonly [number, number];
}): FacilitiesFeatureCollection["features"] {
  return args.features.filter((feature) => {
    if (feature.geometry.type !== "Point") {
      return false;
    }

    const [x, y] = args.projectPoint(feature.geometry.coordinates);
    if (!(Number.isFinite(x) && Number.isFinite(y))) {
      return false;
    }

    return x >= 0 && x <= args.canvasSize.width && y >= 0 && y <= args.canvasSize.height;
  });
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
    if (status.reason === "zoom") {
      return `Facilities (${status.perspective}): hidden (zoom ${(status.zoom ?? 0).toFixed(2)} < ${status.minZoom ?? 0})`;
    }

    if (status.reason === "stress") {
      return `Facilities (${status.perspective}): hidden by stress governor`;
    }

    const zoomGuidance =
      status.perspective === "colocation"
        ? " Zoom in to load raw colocation facilities."
        : " Zoom in to narrow the viewport.";

    return `Facilities (${status.perspective}): hidden by viewport span (${(status.viewportWidthKm ?? 0).toFixed(1)}km > ${status.maxViewportWidthKm ?? 0}km).${zoomGuidance}`;
  }

  if (status.state === "loading") {
    return `Facilities (${status.perspective}): loading...`;
  }

  if (status.state === "degraded") {
    return `Facilities (${status.perspective}): degraded (${status.reason}, count=${status.count}, truncated=${String(status.truncated)})`;
  }

  if (status.state === "error") {
    return `Facilities (${status.perspective}): ${status.reason} (requestId=${status.requestId})`;
  }

  return `Facilities (${status.perspective}): ok (count=${status.count}, truncated=${String(
    status.truncated
  )}, requestId=${status.requestId})`;
}
