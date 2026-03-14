import type { AreaOfInterest } from "@map-migration/geo-kernel/area-of-interest";
import { aoiBboxExceedsLimits } from "@map-migration/geo-kernel/area-of-interest-policy";
import type { BBox } from "@map-migration/geo-kernel/geometry";
import { parsePositiveFloatFlag, parsePositiveIntFlag } from "@/config/env-parsing.service";
import { resolvePolygonBbox } from "@/http/polygon-bbox.service";
import type { TileCoordinate } from "./parcels-route-policy.service.types";

export const PARCELS_MAX_TILESET_TILES = parsePositiveIntFlag(
  process.env.PARCELS_MAX_TILESET_TILES,
  512
);
export const PARCELS_MAX_BBOX_WIDTH_DEGREES = parsePositiveFloatFlag(
  process.env.PARCELS_MAX_BBOX_WIDTH_DEGREES,
  2
);
export const PARCELS_MAX_BBOX_HEIGHT_DEGREES = parsePositiveFloatFlag(
  process.env.PARCELS_MAX_BBOX_HEIGHT_DEGREES,
  2
);
export const PARCELS_MAX_POLYGON_JSON_CHARS = parsePositiveIntFlag(
  process.env.PARCELS_MAX_POLYGON_JSON_CHARS,
  1_000_000
);

function tileXToLongitude(x: number, z: number): number {
  const tileCount = 2 ** z;
  return (x / tileCount) * 360 - 180;
}

function tileYToLatitude(y: number, z: number): number {
  const tileCount = 2 ** z;
  const mercatorY = Math.PI * (1 - (2 * y) / tileCount);
  const latitudeRadians = Math.atan(Math.sinh(mercatorY));
  return (latitudeRadians * 180) / Math.PI;
}

function tileToBbox(tile: TileCoordinate, z: number): BBox {
  return {
    west: tileXToLongitude(tile.x, z),
    east: tileXToLongitude(tile.x + 1, z),
    north: tileYToLatitude(tile.y, z),
    south: tileYToLatitude(tile.y + 1, z),
  };
}

function mergeBboxes(bboxes: readonly BBox[]): BBox {
  const first = bboxes[0];
  if (typeof first === "undefined") {
    throw new Error("At least one bbox is required");
  }

  let west = first.west;
  let south = first.south;
  let east = first.east;
  let north = first.north;

  for (const bbox of bboxes) {
    west = Math.min(west, bbox.west);
    south = Math.min(south, bbox.south);
    east = Math.max(east, bbox.east);
    north = Math.max(north, bbox.north);
  }

  return { west, south, east, north };
}

function tileToPolygonCoordinates(tile: TileCoordinate, z: number): readonly [number, number][] {
  const bbox = tileToBbox(tile, z);
  return [
    [bbox.west, bbox.south],
    [bbox.east, bbox.south],
    [bbox.east, bbox.north],
    [bbox.west, bbox.north],
    [bbox.west, bbox.south],
  ];
}

export function bboxExceedsLimits(bbox: BBox): boolean {
  return aoiBboxExceedsLimits(bbox, {
    maxWidthDegrees: PARCELS_MAX_BBOX_WIDTH_DEGREES,
    maxHeightDegrees: PARCELS_MAX_BBOX_HEIGHT_DEGREES,
  });
}

export function resolveTileSetPolygonGeometry(aoi: Extract<AreaOfInterest, { type: "tileSet" }>): {
  readonly bbox: BBox;
  readonly geometryText: string;
} {
  const uniqueTiles = new Map<string, TileCoordinate>();
  for (const tile of aoi.tiles) {
    uniqueTiles.set(`${String(tile.x)}:${String(tile.y)}`, tile);
  }

  const bboxes: BBox[] = [];
  const coordinates: Array<readonly [readonly [number, number][]]> = [];
  for (const tile of uniqueTiles.values()) {
    bboxes.push(tileToBbox(tile, aoi.z));
    coordinates.push([tileToPolygonCoordinates(tile, aoi.z)]);
  }

  const geometry = {
    type: "MultiPolygon",
    coordinates,
  };

  return {
    bbox: mergeBboxes(bboxes),
    geometryText: JSON.stringify(geometry),
  };
}

export function resolvePolygonGeometry(aoi: Extract<AreaOfInterest, { type: "polygon" }>): {
  readonly bbox: BBox;
  readonly geometryText: string;
} {
  return {
    bbox: resolvePolygonBbox(aoi.geometry),
    geometryText: JSON.stringify(aoi.geometry),
  };
}
