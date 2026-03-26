import { createHash } from "node:crypto";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { type BBox, formatBboxParam } from "@map-migration/geo-kernel/geometry";
import { resolveFacilitiesSelectionGeometry } from "@/geo/facilities/facilities-selection-policy.service";
import { normalizePolygonGeometryGeoJson } from "@/http/polygon-normalization.service";
import type {
  FacilitiesBboxCacheKeyArgs,
  FacilitiesDetailCacheKeyArgs,
  FacilitiesSelectionCacheKeyArgs,
  FacilitiesTableCacheKeyArgs,
} from "./facilities-cache.types";

const BBOX_DECIMALS = 4;

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

function roundTo(value: number, decimals: number): number {
  const precision = 10 ** decimals;
  return Math.round(value * precision) / precision;
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

function quantizeFacilitiesBbox(bbox: BBox): BBox {
  const longitudeRange = quantizeOutwardRange(bbox.west, bbox.east, BBOX_DECIMALS);
  const latitudeRange = quantizeOutwardRange(bbox.south, bbox.north, BBOX_DECIMALS);
  return {
    west: clamp(longitudeRange.min, -180, 180),
    east: clamp(longitudeRange.max, -180, 180),
    south: clamp(latitudeRange.min, -90, 90),
    north: clamp(latitudeRange.max, -90, 90),
  };
}

function hashValue(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function hashFacilitiesCachePayload(value: string): string {
  return hashValue(value);
}

function canonicalizeFacilitiesSelectionPerspectives(
  perspectives: readonly FacilityPerspective[]
): FacilityPerspective[] {
  return [...new Set(perspectives)].sort((left, right) => left.localeCompare(right));
}

export function buildFacilitiesBboxCacheKey(args: FacilitiesBboxCacheKeyArgs): string {
  const canonicalBbox = formatBboxParam(quantizeFacilitiesBbox(args.bbox));
  return [
    "facilities:bbox:v2",
    args.datasetVersion,
    args.perspective,
    String(args.limit),
    canonicalBbox,
  ].join(":");
}

export function buildFacilitiesDetailCacheKey(args: FacilitiesDetailCacheKeyArgs): string {
  return [
    "facilities:detail:v1",
    args.datasetVersion,
    args.perspective,
    encodeURIComponent(args.facilityId),
  ].join(":");
}

export function buildFacilitiesTableCacheKey(args: FacilitiesTableCacheKeyArgs): string {
  return [
    "facilities:table:v1",
    args.datasetVersion,
    args.perspective,
    args.sortBy,
    args.sortOrder,
    String(args.page),
    String(args.pageSize),
  ].join(":");
}

export async function buildFacilitiesSelectionCacheKey(
  args: FacilitiesSelectionCacheKeyArgs
): Promise<string> {
  const resolvedGeometry = resolveFacilitiesSelectionGeometry(args.geometry);
  const normalizedGeometry = await normalizePolygonGeometryGeoJson(resolvedGeometry.geometryText);
  const canonicalPerspectives = canonicalizeFacilitiesSelectionPerspectives(args.perspectives);
  const perspectivesHash = hashValue(canonicalPerspectives.join(","));
  const geometryHash = hashValue(normalizedGeometry.geometryText);

  return [
    "facilities:selection:v1",
    args.datasetVersion,
    perspectivesHash,
    String(args.limitPerPerspective),
    geometryHash,
  ].join(":");
}
