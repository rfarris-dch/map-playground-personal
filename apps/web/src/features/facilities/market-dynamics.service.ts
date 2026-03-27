import type { IMap, MapRenderedFeature } from "@map-migration/map-engine";
import {
  readNullableNumberProperty,
  readStringProperty,
} from "@/lib/map-feature-readers";

const KM_PER_MILE = 1.609_344;
const EARTH_RADIUS_KM = 6371;

const COLO_POINT_LAYERS = ["facilities.colocation.points", "facilities.colocation.icon-fallback"];
const HYPER_POINT_LAYERS = [
  "facilities.hyperscale.points",
  "facilities.hyperscale.icon-fallback",
];
const ALL_POINT_LAYERS = [...COLO_POINT_LAYERS, ...HYPER_POINT_LAYERS];

const COLO_DONUT_COLORS = ["#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];
const HYPER_DONUT_COLORS = ["#10B981", "#34D399", "#6EE7B7", "#A7F3D0"];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ParsedFacility {
  readonly availablePowerMw: number;
  readonly commissionedPowerMw: number;
  readonly distanceKm: number;
  readonly distanceMi: number;
  readonly facilityId: string;
  readonly facilityName: string;
  readonly leaseOrOwn: string | null;
  readonly marketName: string | null;
  readonly perspective: "colocation" | "hyperscale";
  readonly pipelineMw: number;
  readonly plannedPowerMw: number;
  readonly providerId: string;
  readonly providerName: string;
  readonly underConstructionPowerMw: number;
}

export interface PerspectiveAggregation {
  readonly commissionedMw: number;
  readonly facilityCount: number;
  readonly pipelineMw: number;
  readonly vacancyPct: number | null;
}

export interface MarketPerspectiveAggregation {
  readonly commissionedMw: number;
  readonly facilityCount: number;
  readonly pipelineMw: number;
  readonly vacancyPct: number | null;
}

export interface ProviderSegment {
  readonly color: string;
  readonly label: string;
  readonly pct: number;
  readonly valueMw: number;
}

export interface ProviderDonutData {
  readonly segments: readonly ProviderSegment[];
  readonly totalMw: number;
}

export interface FacilityRow {
  readonly commOrOwnMw: number;
  readonly distanceMi: number;
  readonly facilityName: string;
  readonly perspective: "colocation" | "hyperscale";
  readonly pipelineMw: number;
  readonly providerName: string;
}

export interface MarketDynamicsResult {
  readonly colocation: PerspectiveAggregation;
  readonly colocationCommDonut: ProviderDonutData;
  readonly colocationPipelineDonut: ProviderDonutData;
  readonly facilitiesInRadius: readonly FacilityRow[];
  readonly hasMarket: boolean;
  readonly hyperscale: PerspectiveAggregation;
  readonly hyperscaleCommDonut: ProviderDonutData;
  readonly hyperscalePipelineDonut: ProviderDonutData;
  readonly marketColocation: MarketPerspectiveAggregation | null;
  readonly marketHyperscale: MarketPerspectiveAggregation | null;
}

function readCoordinates(
  feature: MapRenderedFeature
): readonly [number, number] | null {
  const geom = feature.geometry;
  if (geom?.type !== "Point") {
    return null;
  }
  const coords = geom.coordinates;
  if (
    !Array.isArray(coords) ||
    coords.length < 2 ||
    typeof coords[0] !== "number" ||
    typeof coords[1] !== "number"
  ) {
    return null;
  }
  return [coords[0], coords[1]];
}

function parseFacility(
  feature: MapRenderedFeature,
  facilityLng: number,
  facilityLat: number
): ParsedFacility | null {
  const coords = readCoordinates(feature);
  if (coords === null) {
    return null;
  }

  const perspective = readStringProperty(feature.properties, "perspective");
  if (perspective !== "colocation" && perspective !== "hyperscale") {
    return null;
  }

  const facilityId = readStringProperty(feature.properties, "facilityId");
  if (facilityId === null) {
    return null;
  }

  const distanceKm = haversineKm(facilityLat, facilityLng, coords[1], coords[0]);
  const commissionedPowerMw =
    readNullableNumberProperty(feature.properties, "commissionedPowerMw") ?? 0;
  const underConstructionPowerMw =
    readNullableNumberProperty(feature.properties, "underConstructionPowerMw") ?? 0;
  const plannedPowerMw =
    readNullableNumberProperty(feature.properties, "plannedPowerMw") ?? 0;
  const availablePowerMw =
    readNullableNumberProperty(feature.properties, "availablePowerMw") ?? 0;

  return {
    availablePowerMw,
    commissionedPowerMw,
    distanceKm,
    distanceMi: distanceKm / KM_PER_MILE,
    facilityId,
    facilityName:
      readStringProperty(feature.properties, "facilityName") ?? "Unknown",
    leaseOrOwn: readStringProperty(feature.properties, "leaseOrOwn"),
    marketName: readStringProperty(feature.properties, "marketName"),
    perspective,
    pipelineMw: underConstructionPowerMw + plannedPowerMw,
    plannedPowerMw,
    providerId:
      readStringProperty(feature.properties, "providerId") ?? "unknown",
    providerName:
      readStringProperty(feature.properties, "providerName") ?? "Unknown",
    underConstructionPowerMw,
  };
}

function aggregatePerspective(
  facilities: readonly ParsedFacility[]
): PerspectiveAggregation {
  let commissionedMw = 0;
  let pipelineMw = 0;
  let availableMw = 0;

  for (const f of facilities) {
    commissionedMw += f.commissionedPowerMw;
    pipelineMw += f.pipelineMw;
    availableMw += f.availablePowerMw;
  }

  const vacancyPct =
    commissionedMw > 0 ? (availableMw / commissionedMw) * 100 : null;

  return {
    commissionedMw,
    facilityCount: facilities.length,
    pipelineMw,
    vacancyPct,
  };
}

function buildProviderDonut(
  facilities: readonly ParsedFacility[],
  valueFn: (f: ParsedFacility) => number,
  colors: readonly string[],
  otherLabel: string
): ProviderDonutData {
  const byProvider = new Map<string, { label: string; total: number }>();
  for (const f of facilities) {
    const val = valueFn(f);
    const existing = byProvider.get(f.providerId);
    if (existing) {
      existing.total += val;
    } else {
      byProvider.set(f.providerId, { label: f.providerName, total: val });
    }
  }

  const sorted = [...byProvider.values()].sort((a, b) => b.total - a.total);
  const totalMw = sorted.reduce((sum, p) => sum + p.total, 0);
  if (totalMw <= 0) {
    return { segments: [], totalMw: 0 };
  }

  const top3 = sorted.slice(0, 3);
  const restMw = sorted.slice(3).reduce((sum, p) => sum + p.total, 0);

  const segments: ProviderSegment[] = top3.map((p, i) => ({
    color: colors[i] ?? colors[colors.length - 1]!,
    label: p.label,
    pct: (p.total / totalMw) * 100,
    valueMw: p.total,
  }));

  if (restMw > 0) {
    segments.push({
      color: colors[3] ?? colors[colors.length - 1]!,
      label: otherLabel,
      pct: (restMw / totalMw) * 100,
      valueMw: restMw,
    });
  }

  return { segments, totalMw };
}

function deduplicateFacilities(
  features: MapRenderedFeature[],
  facilityLng: number,
  facilityLat: number
): ParsedFacility[] {
  const seen = new Set<string>();
  const result: ParsedFacility[] = [];
  for (const feature of features) {
    const parsed = parseFacility(feature, facilityLng, facilityLat);
    if (parsed !== null && !seen.has(parsed.facilityId)) {
      seen.add(parsed.facilityId);
      result.push(parsed);
    }
  }
  return result;
}

export function queryMarketDynamics(
  map: IMap,
  facilityLng: number,
  facilityLat: number,
  radiusMiles: number,
  excludeFacilityId: string,
  facilityMarketName: string | null
): MarketDynamicsResult {
  const canvasSize = map.getCanvasSize();
  const viewportBbox: [[number, number], [number, number]] = [
    [0, 0],
    [canvasSize.width, canvasSize.height],
  ];

  const queryLayers = ALL_POINT_LAYERS.filter((id) => map.hasLayer(id));
  if (queryLayers.length === 0) {
    return emptyResult();
  }

  const allFeatures = map.queryRenderedFeatures(viewportBbox, {
    layers: queryLayers,
  });

  const radiusKm = radiusMiles * KM_PER_MILE;
  const allParsed = deduplicateFacilities(allFeatures, facilityLng, facilityLat);

  const inRadius = allParsed.filter(
    (f) => f.facilityId !== excludeFacilityId && f.distanceKm <= radiusKm
  );

  const coloInRadius = inRadius.filter((f) => f.perspective === "colocation");
  const hyperInRadius = inRadius.filter((f) => f.perspective === "hyperscale");

  const colocation = aggregatePerspective(coloInRadius);
  const hyperscale = aggregatePerspective(hyperInRadius);

  const colocationCommDonut = buildProviderDonut(
    coloInRadius,
    (f) => f.commissionedPowerMw,
    COLO_DONUT_COLORS,
    "Other Providers"
  );
  const colocationPipelineDonut = buildProviderDonut(
    coloInRadius,
    (f) => f.pipelineMw,
    COLO_DONUT_COLORS,
    "Other Providers"
  );
  const hyperscaleCommDonut = buildProviderDonut(
    hyperInRadius,
    (f) => f.commissionedPowerMw,
    HYPER_DONUT_COLORS,
    "Other Users"
  );
  const hyperscalePipelineDonut = buildProviderDonut(
    hyperInRadius,
    (f) => f.pipelineMw,
    HYPER_DONUT_COLORS,
    "Other Users"
  );

  let marketColocation: MarketPerspectiveAggregation | null = null;
  let marketHyperscale: MarketPerspectiveAggregation | null = null;
  const hasMarket = facilityMarketName !== null;

  if (hasMarket) {
    const marketColo = allParsed.filter(
      (f) => f.perspective === "colocation" && f.marketName === facilityMarketName
    );
    const marketHyper = allParsed.filter(
      (f) => f.perspective === "hyperscale" && f.marketName === facilityMarketName
    );
    marketColocation = aggregatePerspective(marketColo);
    marketHyperscale = aggregatePerspective(marketHyper);
  }

  const facilitiesInRadius: FacilityRow[] = inRadius
    .sort((a, b) => a.distanceMi - b.distanceMi)
    .map((f) => ({
      commOrOwnMw: f.commissionedPowerMw,
      distanceMi: f.distanceMi,
      facilityName: f.facilityName,
      perspective: f.perspective,
      pipelineMw: f.pipelineMw,
      providerName: f.providerName,
    }));

  return {
    colocation,
    colocationCommDonut,
    colocationPipelineDonut,
    facilitiesInRadius,
    hasMarket,
    hyperscale,
    hyperscaleCommDonut,
    hyperscalePipelineDonut,
    marketColocation,
    marketHyperscale,
  };
}

function emptyResult(): MarketDynamicsResult {
  const emptyAgg: PerspectiveAggregation = {
    commissionedMw: 0,
    facilityCount: 0,
    pipelineMw: 0,
    vacancyPct: null,
  };
  const emptyDonut: ProviderDonutData = { segments: [], totalMw: 0 };
  return {
    colocation: emptyAgg,
    colocationCommDonut: emptyDonut,
    colocationPipelineDonut: emptyDonut,
    facilitiesInRadius: [],
    hasMarket: false,
    hyperscale: emptyAgg,
    hyperscaleCommDonut: emptyDonut,
    hyperscalePipelineDonut: emptyDonut,
    marketColocation: null,
    marketHyperscale: null,
  };
}
