import type { LngLat } from "@map-migration/map-engine";
import type { MeasureMode, MeasureRuntimeState, MeasureState } from "./measure.types";

type MeasureGeometry =
  | {
      type: "LineString";
      coordinates: LngLat[];
    }
  | {
      type: "Point";
      coordinates: LngLat;
    }
  | {
      type: "Polygon";
      coordinates: LngLat[][];
    };

interface MeasureFeature {
  geometry: MeasureGeometry;
  properties: {
    kind: "area" | "line" | "vertex";
    vertexIndex?: number;
  };
  type: "Feature";
}

export interface MeasureSourceData {
  features: MeasureFeature[];
  type: "FeatureCollection";
}

const EARTH_RADIUS_METERS = 6371008.8;
const WEB_MERCATOR_RADIUS_METERS = 6378137;
const MAX_WEB_MERCATOR_LAT = 85.05112878;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function createLngLat(lng: number, lat: number): LngLat {
  return [lng, lat];
}

function projectToWebMercator(vertex: LngLat): { readonly x: number; readonly y: number } {
  const lngRadians = toRadians(vertex[0]);
  const clampedLat = Math.max(-MAX_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, vertex[1]));
  const latRadians = toRadians(clampedLat);

  return {
    x: WEB_MERCATOR_RADIUS_METERS * lngRadians,
    y: WEB_MERCATOR_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latRadians / 2)),
  };
}

function buildPathVertices(
  mode: MeasureMode,
  vertices: readonly LngLat[],
  cursorVertex: LngLat | null
): LngLat[] {
  if (mode === "off") {
    return [];
  }

  const pathVertices = vertices.map((vertex) => createLngLat(vertex[0], vertex[1]));
  if (cursorVertex === null) {
    return pathVertices;
  }

  pathVertices.push(createLngLat(cursorVertex[0], cursorVertex[1]));
  return pathVertices;
}

function closeRing(vertices: readonly LngLat[]): LngLat[] {
  const ring = vertices.map((vertex) => createLngLat(vertex[0], vertex[1]));
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (!first || !last) {
    return ring;
  }

  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  ring.push(createLngLat(first[0], first[1]));
  return ring;
}

function buildAreaRing(vertices: readonly LngLat[], cursorVertex: LngLat | null): LngLat[] {
  const polygonVertices = vertices.map((vertex) => createLngLat(vertex[0], vertex[1]));
  if (cursorVertex !== null) {
    polygonVertices.push(createLngLat(cursorVertex[0], cursorVertex[1]));
  }

  if (polygonVertices.length < 3) {
    return [];
  }

  return closeRing(polygonVertices);
}

function haversineDistanceMeters(from: LngLat, to: LngLat): number {
  const fromLat = toRadians(from[1]);
  const toLat = toRadians(to[1]);
  const deltaLat = toRadians(to[1] - from[1]);
  const deltaLng = toRadians(to[0] - from[0]);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const a =
    sinDeltaLat * sinDeltaLat +
    Math.cos(fromLat) * Math.cos(toLat) * sinDeltaLng * sinDeltaLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

function polylineDistanceKm(vertices: readonly LngLat[]): number | null {
  if (vertices.length < 2) {
    return null;
  }

  let totalMeters = 0;
  for (let index = 1; index < vertices.length; index += 1) {
    const previous = vertices[index - 1];
    const current = vertices[index];
    if (!previous || !current) {
      continue;
    }
    totalMeters += haversineDistanceMeters(previous, current);
  }

  return totalMeters / 1000;
}

function polygonAreaSqKm(ring: readonly LngLat[]): number | null {
  if (ring.length < 4) {
    return null;
  }

  let twiceAreaMeters = 0;
  for (let index = 1; index < ring.length; index += 1) {
    const previousVertex = ring[index - 1];
    const currentVertex = ring[index];
    if (!previousVertex || !currentVertex) {
      continue;
    }

    const previous = projectToWebMercator(previousVertex);
    const current = projectToWebMercator(currentVertex);
    twiceAreaMeters += previous.x * current.y - current.x * previous.y;
  }

  return Math.abs(twiceAreaMeters) / 2 / 1_000_000;
}

export function emptyMeasureSourceData(): MeasureSourceData {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function buildMeasureState(runtime: MeasureRuntimeState): MeasureState {
  const pathVertices = buildPathVertices(runtime.mode, runtime.vertices, runtime.cursorVertex);
  const distanceKm = polylineDistanceKm(pathVertices);

  let areaSqKm: number | null = null;
  if (runtime.mode === "area") {
    const areaRing = buildAreaRing(runtime.vertices, runtime.cursorVertex);
    areaSqKm = polygonAreaSqKm(areaRing);
  }

  return {
    mode: runtime.mode,
    vertexCount: runtime.vertices.length,
    distanceKm,
    areaSqKm,
  };
}

export function buildMeasureSourceData(runtime: MeasureRuntimeState): MeasureSourceData {
  if (runtime.mode === "off") {
    return emptyMeasureSourceData();
  }

  const features: MeasureFeature[] = [];

  if (runtime.mode === "area") {
    const areaRing = buildAreaRing(runtime.vertices, runtime.cursorVertex);
    if (areaRing.length >= 4) {
      features.push({
        type: "Feature",
        properties: {
          kind: "area",
        },
        geometry: {
          type: "Polygon",
          coordinates: [areaRing],
        },
      });
    }
  }

  const pathVertices = buildPathVertices(runtime.mode, runtime.vertices, runtime.cursorVertex);
  if (pathVertices.length >= 2) {
    features.push({
      type: "Feature",
      properties: {
        kind: "line",
      },
      geometry: {
        type: "LineString",
        coordinates: pathVertices,
      },
    });
  }

  for (let index = 0; index < runtime.vertices.length; index += 1) {
    const vertex = runtime.vertices[index];
    if (!vertex) {
      continue;
    }

    features.push({
      type: "Feature",
      properties: {
        kind: "vertex",
        vertexIndex: index + 1,
      },
      geometry: {
        type: "Point",
        coordinates: createLngLat(vertex[0], vertex[1]),
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export function formatDistance(distanceKm: number | null): string {
  if (distanceKm === null) {
    return "n/a";
  }

  if (distanceKm < 1) {
    return `${(distanceKm * 1000).toFixed(0)} m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(2)} km`;
  }

  return `${distanceKm.toFixed(1)} km`;
}

export function formatArea(areaSqKm: number | null): string {
  if (areaSqKm === null) {
    return "n/a";
  }

  if (areaSqKm < 0.01) {
    return `${(areaSqKm * 1_000_000).toFixed(0)} m^2`;
  }

  return `${areaSqKm.toFixed(2)} km^2`;
}
