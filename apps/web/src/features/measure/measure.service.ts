import type { LngLat } from "@map-migration/map-engine";
import type { MeasureRuntimeState, MeasureState } from "@/features/measure/measure.types";
import type { MeasureFeature, MeasureSourceData } from "./measure.service.types";

const EARTH_RADIUS_METERS = 6_371_008.8;
const WEB_MERCATOR_RADIUS_METERS = 6_378_137;
const MAX_WEB_MERCATOR_LAT = 85.051_128_78;
const CIRCLE_SEGMENTS = 64;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizeLongitude(lng: number): number {
  return ((lng + 540) % 360) - 180;
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

function cloneVertices(vertices: readonly LngLat[]): LngLat[] {
  return vertices.map((vertex) => createLngLat(vertex[0], vertex[1]));
}

function buildPathVertices(vertices: readonly LngLat[], cursorVertex: LngLat | null): LngLat[] {
  const pathVertices = cloneVertices(vertices);
  if (cursorVertex !== null) {
    pathVertices.push(createLngLat(cursorVertex[0], cursorVertex[1]));
  }

  return pathVertices;
}

function closeRing(vertices: readonly LngLat[]): LngLat[] {
  const ring = cloneVertices(vertices);
  if (ring.length === 0) {
    return ring;
  }

  const first = ring[0];
  const last = ring.at(-1);
  if (!(first && last)) {
    return ring;
  }

  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  ring.push(createLngLat(first[0], first[1]));
  return ring;
}

function buildFreeformAreaRing(vertices: readonly LngLat[], cursorVertex: LngLat | null): LngLat[] {
  const polygonVertices = cloneVertices(vertices);
  if (cursorVertex !== null) {
    polygonVertices.push(createLngLat(cursorVertex[0], cursorVertex[1]));
  }

  if (polygonVertices.length < 3) {
    return [];
  }

  return closeRing(polygonVertices);
}

function buildRectangleAreaRing(anchor: LngLat, opposite: LngLat): LngLat[] {
  return closeRing([
    createLngLat(anchor[0], anchor[1]),
    createLngLat(opposite[0], anchor[1]),
    createLngLat(opposite[0], opposite[1]),
    createLngLat(anchor[0], opposite[1]),
  ]);
}

function destinationPoint(center: LngLat, bearingRadians: number, distanceMeters: number): LngLat {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const lat1 = toRadians(center[1]);
  const lng1 = toRadians(center[0]);
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngularDistance = Math.sin(angularDistance);
  const cosAngularDistance = Math.cos(angularDistance);
  const sinBearing = Math.sin(bearingRadians);
  const cosBearing = Math.cos(bearingRadians);

  const sinLat2 = sinLat1 * cosAngularDistance + cosLat1 * sinAngularDistance * cosBearing;
  const lat2 = Math.asin(Math.max(-1, Math.min(1, sinLat2)));
  const lng2 =
    lng1 +
    Math.atan2(
      sinBearing * sinAngularDistance * cosLat1,
      cosAngularDistance - sinLat1 * Math.sin(lat2)
    );

  return createLngLat(
    normalizeLongitude(toDegrees(lng2)),
    Math.max(-MAX_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, toDegrees(lat2)))
  );
}

function buildCircleAreaRing(center: LngLat, edge: LngLat): LngLat[] {
  const radiusMeters = haversineDistanceMeters(center, edge);
  if (radiusMeters <= 0) {
    return [];
  }

  const vertices: LngLat[] = [];
  for (let index = 0; index < CIRCLE_SEGMENTS; index += 1) {
    const bearingRadians = (index / CIRCLE_SEGMENTS) * Math.PI * 2;
    vertices.push(destinationPoint(center, bearingRadians, radiusMeters));
  }

  return closeRing(vertices);
}

function areaCursorVertex(runtime: MeasureRuntimeState): LngLat | null {
  if (runtime.areaComplete) {
    return null;
  }

  return runtime.cursorVertex;
}

function areaEdgeVertex(runtime: MeasureRuntimeState): LngLat | null {
  const committedEdge = runtime.vertices[1];
  if (committedEdge) {
    return committedEdge;
  }

  return areaCursorVertex(runtime);
}

function buildAreaRing(runtime: MeasureRuntimeState): LngLat[] {
  if (runtime.mode !== "area") {
    return [];
  }

  if (runtime.areaShape === "freeform") {
    return buildFreeformAreaRing(runtime.vertices, areaCursorVertex(runtime));
  }

  const anchor = runtime.vertices[0];
  if (!anchor) {
    return [];
  }

  const edge = areaEdgeVertex(runtime);
  if (!edge) {
    return [];
  }

  if (runtime.areaShape === "rectangle") {
    return buildRectangleAreaRing(anchor, edge);
  }

  return buildCircleAreaRing(anchor, edge);
}

function buildAreaLineVertices(
  runtime: MeasureRuntimeState,
  areaRing: readonly LngLat[]
): LngLat[] {
  if (areaRing.length >= 2) {
    return cloneVertices(areaRing);
  }

  if (runtime.areaShape === "freeform") {
    return buildPathVertices(runtime.vertices, areaCursorVertex(runtime));
  }

  return [];
}

function haversineDistanceMeters(from: LngLat, to: LngLat): number {
  const fromLat = toRadians(from[1]);
  const toLat = toRadians(to[1]);
  const deltaLat = toRadians(to[1] - from[1]);
  const deltaLng = toRadians(to[0] - from[0]);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const a =
    sinDeltaLat * sinDeltaLat + Math.cos(fromLat) * Math.cos(toLat) * sinDeltaLng * sinDeltaLng;

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
    if (!(previous && current)) {
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
    if (!(previousVertex && currentVertex)) {
      continue;
    }

    const previous = projectToWebMercator(previousVertex);
    const current = projectToWebMercator(currentVertex);
    twiceAreaMeters += previous.x * current.y - current.x * previous.y;
  }

  return Math.abs(twiceAreaMeters) / 2 / 1_000_000;
}

function canFinishAreaSelection(runtime: MeasureRuntimeState): boolean {
  if (runtime.mode !== "area" || runtime.areaComplete) {
    return false;
  }

  if (runtime.areaShape === "freeform") {
    return runtime.vertices.length >= 3;
  }

  return buildAreaRing(runtime).length >= 4;
}

export function emptyMeasureSourceData(): MeasureSourceData {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function buildMeasureState(runtime: MeasureRuntimeState): MeasureState {
  const areaRing = buildAreaRing(runtime);
  const distanceVertices =
    runtime.mode === "area"
      ? buildAreaLineVertices(runtime, areaRing)
      : buildPathVertices(runtime.vertices, runtime.cursorVertex);

  const distanceKm = polylineDistanceKm(distanceVertices);

  let areaSqKm: number | null = null;
  if (runtime.mode === "area") {
    areaSqKm = polygonAreaSqKm(areaRing);
  }

  return {
    areaShape: runtime.areaShape,
    mode: runtime.mode,
    vertexCount: runtime.vertices.length,
    distanceKm,
    areaSqKm,
    canFinishSelection: canFinishAreaSelection(runtime),
    isSelectionComplete: runtime.mode === "area" && runtime.areaComplete,
    selectionRing:
      runtime.mode === "area" && runtime.areaComplete && areaRing.length >= 4
        ? cloneVertices(areaRing)
        : null,
  };
}

export function buildMeasureSourceData(runtime: MeasureRuntimeState): MeasureSourceData {
  if (runtime.mode === "off") {
    return emptyMeasureSourceData();
  }

  const features: MeasureFeature[] = [];
  const areaRing = buildAreaRing(runtime);

  if (runtime.mode === "area" && areaRing.length >= 4) {
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

  const lineVertices =
    runtime.mode === "area"
      ? buildAreaLineVertices(runtime, areaRing)
      : buildPathVertices(runtime.vertices, runtime.cursorVertex);

  if (lineVertices.length >= 2) {
    features.push({
      type: "Feature",
      properties: {
        kind: "line",
      },
      geometry: {
        type: "LineString",
        coordinates: lineVertices,
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
        vertexIndex: index,
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
