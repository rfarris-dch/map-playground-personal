import type { BBox } from "@map-migration/contracts";

type PolygonCoordinate = readonly [number, number];
type PolygonRing = readonly PolygonCoordinate[];

export interface PolygonGeometryLike {
  readonly coordinates: readonly PolygonRing[];
}

export function resolvePolygonBbox(geometry: PolygonGeometryLike): BBox {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const ring of geometry.coordinates) {
    for (const [longitude, latitude] of ring) {
      west = Math.min(west, longitude);
      south = Math.min(south, latitude);
      east = Math.max(east, longitude);
      north = Math.max(north, latitude);
    }
  }

  if (
    !(
      Number.isFinite(west) &&
      Number.isFinite(south) &&
      Number.isFinite(east) &&
      Number.isFinite(north)
    )
  ) {
    throw new Error("Polygon geometry must include at least one coordinate");
  }

  return { west, south, east, north };
}
