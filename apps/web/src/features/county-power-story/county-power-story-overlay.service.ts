import type {
  CountyPowerStoryGeometryFeature,
  CountyPowerStoryRow,
  CountyPowerStoryTimelineFrameRow,
} from "@map-migration/http-contracts/county-power-story-http";
import type { MarketBoundaryFeature } from "@map-migration/http-contracts/market-boundaries-http";
import type { CountyPowerStoryChapterId } from "./county-power-story.types";

export const COUNTY_POWER_STORY_QUEUE_PULSE_IMAGE_ID = "county-power-story.queue-pulse";
export const COUNTY_POWER_STORY_SCAN_GREEN_IMAGE_ID = "county-power-story.scan-green";
export const COUNTY_POWER_STORY_SCAN_AMBER_IMAGE_ID = "county-power-story.scan-amber";
export const COUNTY_POWER_STORY_SCAN_RED_IMAGE_ID = "county-power-story.scan-red";

export const COUNTY_POWER_STORY_HEARTBEAT_SOURCE_ID = "county-power-story.chapter.heartbeat";
export const COUNTY_POWER_STORY_SUBREGION_SOURCE_ID = "county-power-story.chapter.subregions";
export const COUNTY_POWER_STORY_TRANSFER_BASE_SOURCE_ID =
  "county-power-story.chapter.transfer-base";
export const COUNTY_POWER_STORY_TRANSFER_FLOW_SOURCE_ID =
  "county-power-story.chapter.transfer-flow";
export const COUNTY_POWER_STORY_QUEUE_SOURCE_ID = "county-power-story.chapter.queue";
export const COUNTY_POWER_STORY_QUEUE_HOTSPOT_SOURCE_ID =
  "county-power-story.chapter.queue-hotspots";
export const COUNTY_POWER_STORY_POLICY_SOURCE_ID = "county-power-story.chapter.policy";
export const COUNTY_POWER_STORY_SEAM_HAZE_SOURCE_ID = "county-power-story.chapter.seam-haze";
export const COUNTY_POWER_STORY_TRANSMISSION_SOURCE_ID = "county-power-story.chapter.transmission";
export const COUNTY_POWER_STORY_TRANSMISSION_FLOW_SOURCE_ID =
  "county-power-story.chapter.transmission-flow";

export const COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID =
  "county-power-story.chapter.heartbeat-fill";
export const COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID =
  "county-power-story.chapter.heartbeat-outline";
export const COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID =
  "county-power-story.chapter.subregion-outline";
export const COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID = "county-power-story.chapter.transfer-base";
export const COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID = "county-power-story.chapter.transfer-flow";
export const COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID = "county-power-story.chapter.queue-heat";
export const COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID =
  "county-power-story.chapter.queue-hotspots";
export const COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID =
  "county-power-story.chapter.transmission-base";
export const COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID =
  "county-power-story.chapter.transmission-flow";
export const COUNTY_POWER_STORY_POLICY_RING_LAYER_ID = "county-power-story.chapter.policy-rings";
export const COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID =
  "county-power-story.chapter.policy-centers";
export const COUNTY_POWER_STORY_SCAN_LAYER_ID = "county-power-story.chapter.county-scan";
export const COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID = "county-power-story.chapter.seam-haze";

export const COUNTY_POWER_STORY_TRANSMISSION_TILE_URL =
  "https://openinframap.org/map/power/{z}/{x}/{y}.pbf";

const TAU = Math.PI * 2;
const EARTH_RADIUS_KM = 6371;

type Position = readonly [number, number];

export interface ChapterVisibilityFlags {
  readonly chapterId: CountyPowerStoryChapterId;
  readonly chapterVisible: boolean;
  readonly seamHazeEnabled: boolean;
}

export interface AnimatedRouteFeatureProperties {
  readonly capacityProxyMw: number;
  readonly color: string;
  readonly frictionScore: number;
  readonly opacity: number;
}

export interface AnimatedRoute {
  readonly color: string;
  readonly coordinates: readonly Position[];
  readonly frictionScore: number;
  readonly id: string;
  readonly opacity: number;
  readonly speedKmps: number;
  readonly totalLengthKm: number;
  readonly widthKm: number;
}

interface QueueSourceRow {
  readonly categoryKey: string | null;
  readonly countyFips: string;
  readonly normalizedScore: number;
  readonly pulseAmplitude: number;
  readonly seed: number;
}

interface GeometryBoundsAccumulator {
  east: number;
  north: number;
  south: number;
  west: number;
}

type PatternCategory = "advantaged" | "constrained" | "low-confidence" | "none";

function pointFeature(
  coordinates: Position,
  properties: Readonly<Record<string, boolean | number | string | null>>
): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [coordinates[0], coordinates[1]],
    },
    properties: { ...properties },
  };
}

function lineFeature(
  id: string,
  coordinates: readonly Position[],
  properties: AnimatedRouteFeatureProperties
): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: "Feature",
    id,
    geometry: {
      type: "LineString",
      coordinates: coordinates.map((coordinate) => [coordinate[0], coordinate[1]]),
    },
    properties: {
      capacityProxyMw: properties.capacityProxyMw,
      color: properties.color,
      frictionScore: properties.frictionScore,
      opacity: properties.opacity,
    },
  };
}

function polygonFeatureFromBoundary(
  feature: MarketBoundaryFeature,
  color: string
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null {
  if (!(feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon")) {
    return null;
  }

  return {
    type: "Feature",
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      marketId: feature.properties.marketId,
      operator: feature.properties.regionName,
      color,
      regionId: feature.properties.regionId,
      regionName: feature.properties.regionName,
    },
  };
}

function positionFromCoordinate(coordinate: readonly number[] | null | undefined): Position | null {
  if (!Array.isArray(coordinate)) {
    return null;
  }

  const [lng, lat] = coordinate;
  if (!(Number.isFinite(lng) && Number.isFinite(lat))) {
    return null;
  }

  return [lng, lat];
}

export function emptyPointFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function emptyLineFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function emptyPolygonFeatureCollection(): GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
> {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export function buildCountyCentroidsByFips(
  features: readonly CountyPowerStoryGeometryFeature[]
): ReadonlyMap<string, Position> {
  const centroidsByCounty = new Map<string, Position>();

  for (const feature of features) {
    const [lng, lat] = feature.properties.centroid;
    centroidsByCounty.set(feature.properties.countyFips, [lng, lat]);
  }

  return centroidsByCounty;
}

function normalizeOperatorName(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ");
}

function operatorPaletteIndex(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 33 + character.charCodeAt(0)) % 2_147_483_647;
  }

  return hash;
}

export function countyPowerOperatorColor(value: string | null | undefined): string {
  const normalized = normalizeOperatorName(value);
  if (normalized.length === 0) {
    return "#64748b";
  }

  const palette = [
    "#2563eb",
    "#0ea5e9",
    "#14b8a6",
    "#22c55e",
    "#84cc16",
    "#f59e0b",
    "#f97316",
    "#ef4444",
    "#d946ef",
    "#8b5cf6",
  ];

  return palette[operatorPaletteIndex(normalized) % palette.length] ?? "#64748b";
}

function updateBounds(
  bounds: GeometryBoundsAccumulator,
  coordinates: readonly Position[]
): GeometryBoundsAccumulator {
  const nextBounds = {
    east: bounds.east,
    north: bounds.north,
    south: bounds.south,
    west: bounds.west,
  };

  for (const coordinate of coordinates) {
    nextBounds.west = Math.min(nextBounds.west, coordinate[0]);
    nextBounds.east = Math.max(nextBounds.east, coordinate[0]);
    nextBounds.south = Math.min(nextBounds.south, coordinate[1]);
    nextBounds.north = Math.max(nextBounds.north, coordinate[1]);
  }

  return nextBounds;
}

function walkGeometryBounds(geometry: GeoJSON.Geometry): GeometryBoundsAccumulator | null {
  const initialBounds: GeometryBoundsAccumulator = {
    east: Number.NEGATIVE_INFINITY,
    north: Number.NEGATIVE_INFINITY,
    south: Number.POSITIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
  };

  if (geometry.type === "Polygon") {
    let bounds = initialBounds;
    for (const ring of geometry.coordinates) {
      const positions = ring.flatMap((coordinate) => {
        const position = positionFromCoordinate(coordinate);
        return position === null ? [] : [position];
      });
      bounds = updateBounds(bounds, positions);
    }
    return bounds;
  }

  if (geometry.type === "MultiPolygon") {
    let bounds = initialBounds;
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        const positions = ring.flatMap((coordinate) => {
          const position = positionFromCoordinate(coordinate);
          return position === null ? [] : [position];
        });
        bounds = updateBounds(bounds, positions);
      }
    }
    return bounds;
  }

  return null;
}

function boundaryCentroid(feature: MarketBoundaryFeature): Position | null {
  const bounds = walkGeometryBounds(feature.geometry);
  if (bounds === null) {
    return null;
  }

  return [(bounds.west + bounds.east) / 2, (bounds.south + bounds.north) / 2];
}

export function dominantWholesaleOperator(
  rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>
): string | null {
  const operatorScores = new Map<string, number>();

  for (const row of rowsByCounty.values()) {
    const operator = normalizeOperatorName(row.wholesaleOperator);
    if (operator.length === 0) {
      continue;
    }

    operatorScores.set(operator, (operatorScores.get(operator) ?? 0) + row.normalizedScore);
  }

  let dominant: string | null = null;
  let dominantScore = Number.NEGATIVE_INFINITY;
  for (const [operator, score] of operatorScores) {
    if (score > dominantScore) {
      dominant = operator;
      dominantScore = score;
    }
  }

  return dominant;
}

export function buildOperatorHeartbeatSources(args: {
  readonly marketFeatures: readonly MarketBoundaryFeature[];
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
  readonly submarketFeatures: readonly MarketBoundaryFeature[];
}): {
  readonly activeMarketIds: ReadonlySet<string>;
  readonly marketSourceData: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  readonly submarketSourceData: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
} {
  const dominantOperator = dominantWholesaleOperator(args.rowsByCounty);
  const activeMarketIds = new Set<string>();

  const marketSourceData = emptyPolygonFeatureCollection();
  for (const feature of args.marketFeatures) {
    const color = countyPowerOperatorColor(feature.properties.regionName);
    const boundaryFeature = polygonFeatureFromBoundary(feature, color);
    if (boundaryFeature !== null) {
      marketSourceData.features.push(boundaryFeature);
    }

    const candidateNames = [
      normalizeOperatorName(feature.properties.marketId),
      normalizeOperatorName(feature.properties.regionName),
    ];
    if (dominantOperator !== null && candidateNames.includes(dominantOperator)) {
      activeMarketIds.add(String(feature.id));
    }
  }

  const submarketSourceData = emptyPolygonFeatureCollection();
  for (const feature of args.submarketFeatures) {
    const boundaryFeature = polygonFeatureFromBoundary(
      feature,
      countyPowerOperatorColor(feature.properties.parentRegionName)
    );
    if (boundaryFeature !== null) {
      submarketSourceData.features.push(boundaryFeature);
    }
  }

  return {
    activeMarketIds,
    marketSourceData,
    submarketSourceData,
  };
}

function positiveNumberOrZero(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function buildTransferConnectorSourceData(args: {
  readonly marketFeatures: readonly MarketBoundaryFeature[];
  readonly submarketFeatures: readonly MarketBoundaryFeature[];
}): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const marketCenters = new Map<string, Position>();
  for (const feature of args.marketFeatures) {
    const centroid = boundaryCentroid(feature);
    if (centroid !== null) {
      marketCenters.set(feature.properties.marketId, centroid);
    }
  }

  const connectors = emptyLineFeatureCollection();

  for (const feature of args.submarketFeatures) {
    const from = boundaryCentroid(feature);
    const to = marketCenters.get(feature.properties.marketId);
    if (from === null || typeof to === "undefined") {
      continue;
    }

    const commissionedPowerMw = positiveNumberOrZero(feature.properties.commissionedPowerMw);
    const vacancy = positiveNumberOrZero(feature.properties.vacancy);
    const absorption = positiveNumberOrZero(feature.properties.absorption);
    const frictionScore = Math.max(0.12, Math.min(0.95, 1 - Math.min(1, absorption + vacancy)));

    connectors.features.push(
      lineFeature(String(feature.id), [from, to], {
        capacityProxyMw: Math.max(120, commissionedPowerMw),
        color: countyPowerOperatorColor(feature.properties.parentRegionName),
        frictionScore,
        opacity: 0.35 + (1 - frictionScore) * 0.45,
      })
    );
  }

  return connectors;
}

function queueRowsFromTimelineFrame(
  rows: readonly CountyPowerStoryTimelineFrameRow[]
): readonly QueueSourceRow[] {
  return rows.map((row) => ({
    categoryKey: row.categoryKey,
    countyFips: row.countyFips,
    normalizedScore: row.normalizedScore,
    pulseAmplitude: row.pulseAmplitude,
    seed: row.seed,
  }));
}

function hotspotRankedRows(
  rows: readonly QueueSourceRow[],
  limit: number
): readonly QueueSourceRow[] {
  return [...rows]
    .sort((left, right) => right.normalizedScore - left.normalizedScore)
    .slice(0, limit);
}

function queueColor(categoryKey: string | null): string {
  if (categoryKey === "solar") {
    return "#f59e0b";
  }

  if (categoryKey === "storage") {
    return "#2563eb";
  }

  if (categoryKey === "wind") {
    return "#16a34a";
  }

  return "#7c3aed";
}

export function buildQueuePressureSources(args: {
  readonly centroidsByCounty: ReadonlyMap<string, Position>;
  readonly frameRows: readonly CountyPowerStoryTimelineFrameRow[];
}): {
  readonly hotspotSourceData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  readonly pressureSourceData: GeoJSON.FeatureCollection<GeoJSON.Point>;
} {
  const queueRows = queueRowsFromTimelineFrame(args.frameRows);
  const pressureSourceData = emptyPointFeatureCollection();

  for (const row of queueRows) {
    const centroid = args.centroidsByCounty.get(row.countyFips);
    if (typeof centroid === "undefined") {
      continue;
    }

    pressureSourceData.features.push(
      pointFeature(centroid, {
        categoryKey: row.categoryKey,
        color: queueColor(row.categoryKey),
        countyFips: row.countyFips,
        pressureScore: row.normalizedScore * 100,
        pulseAmplitude: row.pulseAmplitude,
        seed: row.seed,
      })
    );
  }

  const hotspotSourceData = emptyPointFeatureCollection();
  for (const row of hotspotRankedRows(queueRows, 18)) {
    const centroid = args.centroidsByCounty.get(row.countyFips);
    if (typeof centroid === "undefined") {
      continue;
    }

    hotspotSourceData.features.push(
      pointFeature(centroid, {
        categoryKey: row.categoryKey,
        countyFips: row.countyFips,
        pressureScore: row.normalizedScore * 100,
      })
    );
  }

  return {
    hotspotSourceData,
    pressureSourceData,
  };
}

export function buildPolicyShockwaveSourceData(args: {
  readonly centroidsByCounty: ReadonlyMap<string, Position>;
  readonly nowMs: number;
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const sourceData = emptyPointFeatureCollection();
  const cycleMs = 1800;

  for (const row of args.rowsByCounty.values()) {
    const policyScore = positiveNumberOrZero(row.policyMomentumScore);
    const policyEvents = positiveNumberOrZero(row.policyEventCount);
    const moratoriumWeight = moratoriumIntensity(row.moratoriumStatus);
    const intensity = Math.max(policyScore / 10, policyEvents / 8, moratoriumWeight);
    if (intensity < 0.35) {
      continue;
    }

    const centroid = args.centroidsByCounty.get(row.countyFips);
    if (typeof centroid === "undefined") {
      continue;
    }

    const phase = ((args.nowMs + row.seed * 997) % cycleMs) / cycleMs;
    const direction = policyDirection(row);

    sourceData.features.push(
      pointFeature(centroid, {
        countyFips: row.countyFips,
        direction,
        impactScore: intensity,
        phase,
      })
    );
  }

  return sourceData;
}

function moratoriumIntensity(status: CountyPowerStoryRow["moratoriumStatus"]): number {
  if (status === "active") {
    return 1;
  }

  if (status === "watch") {
    return 0.7;
  }

  return 0;
}

function policyDirection(row: CountyPowerStoryRow): "supportive" | "restrictive" | "watch" {
  if (row.moratoriumStatus === "active") {
    return "restrictive";
  }

  if (row.moratoriumStatus === "watch") {
    return "watch";
  }

  if (row.policyMomentumScore !== null && row.policyMomentumScore > 0) {
    return "supportive";
  }

  return "watch";
}

export function buildSeamHazeSourceData(args: {
  readonly centroidsByCounty: ReadonlyMap<string, Position>;
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
}): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const sourceData = emptyPointFeatureCollection();

  for (const row of args.rowsByCounty.values()) {
    if (!row.isSeamCounty) {
      continue;
    }

    const centroid = args.centroidsByCounty.get(row.countyFips);
    if (typeof centroid === "undefined") {
      continue;
    }

    sourceData.features.push(
      pointFeature(centroid, {
        countyFips: row.countyFips,
        intensity: 0.45 + row.normalizedScore * 0.55,
      })
    );
  }

  return sourceData;
}

export function scanCategoryForRow(row: CountyPowerStoryRow | null): PatternCategory {
  if (row === null) {
    return "none";
  }

  if (
    row.moratoriumStatus === "active" ||
    (row.direction === "warm" && row.normalizedScore > 0.62)
  ) {
    return "constrained";
  }

  if (
    row.moratoriumStatus === "watch" ||
    row.outlineIntensity < 0.22 ||
    row.pulseAmplitude < 0.15
  ) {
    return "low-confidence";
  }

  if (row.direction === "cool" || row.normalizedScore < 0.34) {
    return "advantaged";
  }

  return "none";
}

export function buildTransmissionCorridorSourceData(args: {
  readonly centroidsByCounty: ReadonlyMap<string, Position>;
  readonly rowsByCounty: ReadonlyMap<string, CountyPowerStoryRow>;
}): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const groupedRows = new Map<string, CountyPowerStoryRow[]>();

  for (const row of args.rowsByCounty.values()) {
    const operator = normalizeOperatorName(row.wholesaleOperator);
    if (operator.length === 0) {
      continue;
    }

    const existing = groupedRows.get(operator) ?? [];
    existing.push(row);
    groupedRows.set(operator, existing);
  }

  const sourceData = emptyLineFeatureCollection();

  for (const [operator, rows] of groupedRows) {
    const selectedRows = [...rows]
      .sort((left, right) => {
        const leftWeight =
          positiveNumberOrZero(left.transmissionMiles500kvPlus) * 2 +
          positiveNumberOrZero(left.transmissionMiles345kvPlus) +
          positiveNumberOrZero(left.transmissionMiles765kvPlus) * 2.5;
        const rightWeight =
          positiveNumberOrZero(right.transmissionMiles500kvPlus) * 2 +
          positiveNumberOrZero(right.transmissionMiles345kvPlus) +
          positiveNumberOrZero(right.transmissionMiles765kvPlus) * 2.5;
        return rightWeight - leftWeight;
      })
      .slice(0, 5)
      .filter((row) => args.centroidsByCounty.has(row.countyFips))
      .sort((left, right) => {
        const leftCenter = args.centroidsByCounty.get(left.countyFips);
        const rightCenter = args.centroidsByCounty.get(right.countyFips);
        if (typeof leftCenter === "undefined" || typeof rightCenter === "undefined") {
          return 0;
        }

        return leftCenter[0] - rightCenter[0];
      });

    for (let index = 0; index < selectedRows.length - 1; index += 1) {
      const from = selectedRows[index];
      const to = selectedRows[index + 1];
      if (typeof from === "undefined" || typeof to === "undefined") {
        continue;
      }

      const fromCentroid = args.centroidsByCounty.get(from.countyFips);
      const toCentroid = args.centroidsByCounty.get(to.countyFips);
      if (typeof fromCentroid === "undefined" || typeof toCentroid === "undefined") {
        continue;
      }

      const capacityProxyMw =
        positiveNumberOrZero(from.transmissionMiles500kvPlus) * 55 +
        positiveNumberOrZero(from.transmissionMiles345kvPlus) * 25 +
        positiveNumberOrZero(from.transmissionMiles765kvPlus) * 70;

      sourceData.features.push(
        lineFeature(`${operator}:${index}`, [fromCentroid, toCentroid], {
          capacityProxyMw: Math.max(220, capacityProxyMw),
          color: countyPowerOperatorColor(operator),
          frictionScore: 0.18,
          opacity: 0.82,
        })
      );
    }
  }

  return sourceData;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineKm(left: Position, right: Position): number {
  const deltaLat = degreesToRadians(right[1] - left[1]);
  const deltaLng = degreesToRadians(right[0] - left[0]);
  const leftLat = degreesToRadians(left[1]);
  const rightLat = degreesToRadians(right[1]);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function interpolatePosition(left: Position, right: Position, progress: number): Position {
  return [left[0] + (right[0] - left[0]) * progress, left[1] + (right[1] - left[1]) * progress];
}

function routeLengthKm(coordinates: readonly Position[]): number {
  let total = 0;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const current = coordinates[index];
    const next = coordinates[index + 1];
    if (typeof current === "undefined" || typeof next === "undefined") {
      continue;
    }

    total += haversineKm(current, next);
  }

  return total;
}

interface LineSegmentWindow {
  readonly current: Position;
  readonly next: Position;
  readonly segmentEndKm: number;
  readonly segmentKm: number;
  readonly segmentStartKm: number;
}

function readLineSegmentWindow(
  coordinates: readonly Position[],
  index: number,
  traveledKm: number
): LineSegmentWindow | null {
  const current = coordinates[index];
  const next = coordinates[index + 1];
  if (typeof current === "undefined" || typeof next === "undefined") {
    return null;
  }

  const segmentKm = haversineKm(current, next);
  return {
    current,
    next,
    segmentEndKm: traveledKm + segmentKm,
    segmentKm,
    segmentStartKm: traveledKm,
  };
}

function appendSegmentSlice(args: {
  readonly endKm: number;
  readonly segment: LineSegmentWindow;
  readonly sliced: Position[];
  readonly startKm: number;
}): boolean {
  const segmentSpanKm = Math.max(args.segment.segmentKm, 0.0001);
  const startProgress =
    args.startKm <= args.segment.segmentStartKm
      ? 0
      : (args.startKm - args.segment.segmentStartKm) / segmentSpanKm;
  const endProgress =
    args.endKm >= args.segment.segmentEndKm
      ? 1
      : (args.endKm - args.segment.segmentStartKm) / segmentSpanKm;

  const startPoint = interpolatePosition(
    args.segment.current,
    args.segment.next,
    Math.max(0, Math.min(1, startProgress))
  );
  const endPoint = interpolatePosition(
    args.segment.current,
    args.segment.next,
    Math.max(0, Math.min(1, endProgress))
  );

  if (args.sliced.length === 0) {
    args.sliced.push(startPoint);
  }

  if (endProgress >= 1) {
    args.sliced.push(args.segment.next);
    return false;
  }

  args.sliced.push(endPoint);
  return true;
}

function sliceLineCoordinates(
  coordinates: readonly Position[],
  startKm: number,
  endKm: number
): readonly Position[] {
  if (coordinates.length === 0) {
    return [];
  }

  const sliced: Position[] = [];
  let traveledKm = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const segment = readLineSegmentWindow(coordinates, index, traveledKm);
    if (segment === null) {
      continue;
    }

    if (segment.segmentEndKm < startKm) {
      traveledKm = segment.segmentEndKm;
      continue;
    }

    if (segment.segmentStartKm > endKm) {
      break;
    }

    const sliceEnded = appendSegmentSlice({
      endKm,
      segment,
      sliced,
      startKm,
    });

    if (sliceEnded) {
      break;
    }

    traveledKm = segment.segmentEndKm;
  }

  if (sliced.length === 1) {
    const firstPoint = sliced[0];
    if (typeof firstPoint !== "undefined") {
      sliced.push(firstPoint);
    }
  }

  return sliced;
}

export function prepareAnimatedRoutes(
  sourceData: GeoJSON.FeatureCollection<GeoJSON.LineString>
): readonly AnimatedRoute[] {
  const routes: AnimatedRoute[] = [];

  for (const [index, feature] of sourceData.features.entries()) {
    const coordinates = feature.geometry.coordinates.flatMap((coordinate) => {
      const position = positionFromCoordinate(coordinate);
      return position === null ? [] : [position];
    });
    const totalLengthKm = routeLengthKm(coordinates);
    if (totalLengthKm <= 0) {
      continue;
    }

    const capacityProxyMw =
      typeof feature.properties?.capacityProxyMw === "number"
        ? feature.properties.capacityProxyMw
        : 220;
    const frictionScore =
      typeof feature.properties?.frictionScore === "number"
        ? feature.properties.frictionScore
        : 0.35;

    routes.push({
      color: typeof feature.properties?.color === "string" ? feature.properties.color : "#f59e0b",
      coordinates,
      frictionScore,
      id: typeof feature.id === "string" ? feature.id : `route-${index}`,
      opacity: typeof feature.properties?.opacity === "number" ? feature.properties.opacity : 0.8,
      speedKmps: Math.max(3.5, 11 - frictionScore * 6),
      totalLengthKm,
      widthKm: Math.max(16, capacityProxyMw / 36),
    });
  }

  return routes;
}

function routeSegmentsForWindow(
  route: AnimatedRoute,
  startKm: number,
  endKm: number
): readonly (readonly Position[])[] {
  if (startKm <= endKm) {
    return [sliceLineCoordinates(route.coordinates, startKm, endKm)];
  }

  return [
    sliceLineCoordinates(route.coordinates, startKm, route.totalLengthKm),
    sliceLineCoordinates(route.coordinates, 0, endKm),
  ];
}

export function buildAnimatedRouteSegments(args: {
  readonly routes: readonly AnimatedRoute[];
  readonly seconds: number;
}): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const sourceData = emptyLineFeatureCollection();

  for (const route of args.routes) {
    const phaseOffset = (operatorPaletteIndex(route.id) % 1000) / 100;
    const centerKm = ((args.seconds + phaseOffset) * route.speedKmps) % route.totalLengthKm;
    const startKm = (centerKm - route.widthKm / 2 + route.totalLengthKm) % route.totalLengthKm;
    const endKm = (centerKm + route.widthKm / 2) % route.totalLengthKm;

    const segments = routeSegmentsForWindow(route, startKm, endKm);
    for (const [index, coordinates] of segments.entries()) {
      if (coordinates.length < 2) {
        continue;
      }

      sourceData.features.push(
        lineFeature(`${route.id}:${index}`, coordinates, {
          capacityProxyMw: route.widthKm * 40,
          color: route.color,
          frictionScore: route.frictionScore,
          opacity: route.opacity,
        })
      );
    }
  }

  return sourceData;
}

export function visibleChapterLayerIds(args: ChapterVisibilityFlags): readonly string[] {
  if (!args.chapterVisible) {
    return args.seamHazeEnabled ? [COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID] : [];
  }

  if (args.chapterId === "operator-heartbeat") {
    return [
      COUNTY_POWER_STORY_HEARTBEAT_FILL_LAYER_ID,
      COUNTY_POWER_STORY_HEARTBEAT_OUTLINE_LAYER_ID,
      COUNTY_POWER_STORY_SUBREGION_OUTLINE_LAYER_ID,
      ...(args.seamHazeEnabled ? [COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID] : []),
    ];
  }

  if (args.chapterId === "transfer-friction") {
    return [
      COUNTY_POWER_STORY_TRANSFER_BASE_LAYER_ID,
      COUNTY_POWER_STORY_TRANSFER_FLOW_LAYER_ID,
      ...(args.seamHazeEnabled ? [COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID] : []),
    ];
  }

  if (args.chapterId === "queue-pressure-storm") {
    return [COUNTY_POWER_STORY_QUEUE_HEAT_LAYER_ID, COUNTY_POWER_STORY_QUEUE_HOTSPOT_LAYER_ID];
  }

  if (args.chapterId === "transmission-current") {
    return [
      COUNTY_POWER_STORY_TRANSMISSION_BASE_LAYER_ID,
      COUNTY_POWER_STORY_TRANSMISSION_FLOW_LAYER_ID,
    ];
  }

  if (args.chapterId === "policy-shockwaves") {
    return [COUNTY_POWER_STORY_POLICY_RING_LAYER_ID, COUNTY_POWER_STORY_POLICY_CENTER_LAYER_ID];
  }

  return [
    COUNTY_POWER_STORY_SCAN_LAYER_ID,
    ...(args.seamHazeEnabled ? [COUNTY_POWER_STORY_SEAM_HAZE_LAYER_ID] : []),
  ];
}

function transparentImageBytes(size: number): Uint8Array {
  return new Uint8Array(size * size * 4);
}

export function createPulsingDotImage(args: {
  readonly outerColor: string;
  readonly repaint: () => void;
  readonly size?: number;
}): import("maplibre-gl").StyleImageInterface {
  const size = args.size ?? 128;
  let context: CanvasRenderingContext2D | null = null;

  return {
    width: size,
    height: size,
    data: transparentImageBytes(size),
    onAdd(): void {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      context = canvas.getContext("2d");
    },
    render(): boolean {
      if (context === null) {
        return false;
      }

      const t = (performance.now() % 1200) / 1200;
      const radius = size * 0.13;
      const outerRadius = radius + size * 0.33 * t;

      context.clearRect(0, 0, size, size);
      context.beginPath();
      context.arc(size / 2, size / 2, outerRadius, 0, TAU);
      context.fillStyle = args.outerColor.replace("ALPHA", String(1 - t));
      context.fill();

      context.beginPath();
      context.arc(size / 2, size / 2, radius, 0, TAU);
      context.fillStyle = "#ffffff";
      context.strokeStyle = "#f8fafc";
      context.lineWidth = 2 + (1 - t) * 3;
      context.fill();
      context.stroke();

      this.data = context.getImageData(0, 0, size, size).data;
      args.repaint();
      return true;
    },
  };
}

export function createStripePatternImage(args: {
  readonly color: string;
  readonly repaint: () => void;
  readonly size?: number;
}): import("maplibre-gl").StyleImageInterface {
  const size = args.size ?? 64;
  let context: CanvasRenderingContext2D | null = null;

  return {
    width: size,
    height: size,
    data: transparentImageBytes(size),
    onAdd(): void {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      context = canvas.getContext("2d");
    },
    render(): boolean {
      if (context === null) {
        return false;
      }

      const phase = ((performance.now() / 1000) * 24) % size;
      context.clearRect(0, 0, size, size);
      context.strokeStyle = args.color;
      context.lineWidth = 7;

      for (let x = -size; x < size * 2; x += 16) {
        context.beginPath();
        context.moveTo(x + phase, 0);
        context.lineTo(x - size + phase, size);
        context.stroke();
      }

      this.data = context.getImageData(0, 0, size, size).data;
      args.repaint();
      return true;
    },
  };
}
