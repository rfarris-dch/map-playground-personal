import type { FacilitiesFeatureCollection, ParcelsFeatureCollection } from "@map-migration/http-contracts";
import type { LngLat } from "@map-migration/map-engine";
import type { MeasureSelectionSummaryArgs } from "@/features/measure/measure-analysis.service.types";
import type {
  MeasureParcelSelectionSummary,
  MeasurePerspectiveSelectionSummary,
  MeasureProviderSummary,
  MeasureSelectedFacility,
  MeasureSelectedParcel,
  MeasureSelectionSummary,
} from "@/features/measure/measure-analysis.types";

const POINT_ON_SEGMENT_EPSILON = 1e-9;
const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;
const COUNTY_GEOID_PREFIX_PATTERN = /^([0-9]{5})/;

function resolveDisplayName(name: string, fallback: string): string {
  const normalizedName = name.trim();
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  const normalizedFallback = fallback.trim();
  if (normalizedFallback.length > 0) {
    return normalizedFallback;
  }

  return "-";
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readPointCoordinates(value: unknown): LngLat | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const lng = value[0];
  const lat = value[1];
  if (!(isFiniteCoordinate(lng) && isFiniteCoordinate(lat))) {
    return null;
  }

  return [lng, lat];
}

function pointOnSegment(point: LngLat, segmentStart: LngLat, segmentEnd: LngLat): boolean {
  const [x, y] = point;
  const [x1, y1] = segmentStart;
  const [x2, y2] = segmentEnd;

  const crossProduct = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(crossProduct) > POINT_ON_SEGMENT_EPSILON) {
    return false;
  }

  const dotProduct = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dotProduct < -POINT_ON_SEGMENT_EPSILON) {
    return false;
  }

  const segmentLengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (dotProduct - segmentLengthSquared > POINT_ON_SEGMENT_EPSILON) {
    return false;
  }

  return true;
}

function isPointInPolygon(point: LngLat, ring: readonly LngLat[]): boolean {
  if (ring.length < 4) {
    return false;
  }

  for (let index = 1; index < ring.length; index += 1) {
    const previousVertex = ring[index - 1];
    const currentVertex = ring[index];
    if (!(previousVertex && currentVertex)) {
      continue;
    }

    if (pointOnSegment(point, previousVertex, currentVertex)) {
      return true;
    }
  }

  let inside = false;
  const pointX = point[0];
  const pointY = point[1];

  for (
    let index = 0, previousIndex = ring.length - 1;
    index < ring.length;
    previousIndex = index, index += 1
  ) {
    const current = ring[index];
    const previous = ring[previousIndex];
    if (!(current && previous)) {
      continue;
    }

    const currentX = current[0];
    const currentY = current[1];
    const previousX = previous[0];
    const previousY = previous[1];
    const isCrossing = currentY > pointY !== previousY > pointY;
    if (!isCrossing) {
      continue;
    }

    const xAtIntersection =
      ((previousX - currentX) * (pointY - currentY)) / (previousY - currentY) + currentX;
    if (pointX <= xAtIntersection) {
      inside = !inside;
    }
  }

  return inside;
}

function toSelectedFacility(
  feature: FacilitiesFeatureCollection["features"][number]
): MeasureSelectedFacility | null {
  const coordinates = readPointCoordinates(feature.geometry.coordinates);
  if (coordinates === null) {
    return null;
  }

  const properties = feature.properties;
  const facilityId = properties.facilityId;
  const providerId = properties.providerId;
  return {
    address: properties.address,
    availablePowerMw: properties.availablePowerMw,
    city: properties.city,
    commissionedPowerMw: properties.commissionedPowerMw,
    commissionedSemantic: properties.commissionedSemantic,
    coordinates,
    countyFips: properties.countyFips,
    facilityId,
    facilityName: resolveDisplayName(properties.facilityName, "Unknown facility"),
    leaseOrOwn: properties.leaseOrOwn,
    plannedPowerMw: properties.plannedPowerMw,
    perspective: properties.perspective,
    providerId,
    providerName: resolveDisplayName(properties.providerName, "Unknown provider"),
    squareFootage: properties.squareFootage,
    state: properties.state,
    stateAbbrev: properties.stateAbbrev,
    statusLabel: properties.statusLabel,
    underConstructionPowerMw: properties.underConstructionPowerMw,
  };
}

function toSelectedParcel(
  feature: ParcelsFeatureCollection["features"][number]
): MeasureSelectedParcel {
  let coordinates: LngLat | null = null;
  if (feature.geometry?.type === "Point") {
    coordinates = readPointCoordinates(feature.geometry.coordinates);
  }

  return {
    attrs: feature.properties.attrs,
    coordinates,
    geoid: feature.properties.geoid,
    parcelId: feature.properties.parcelId,
    state2: feature.properties.state2,
  };
}

function filterSelection(
  features: FacilitiesFeatureCollection["features"],
  ring: readonly LngLat[]
): MeasureSelectedFacility[] {
  return features.reduce<MeasureSelectedFacility[]>((selected, feature) => {
    const nextFacility = toSelectedFacility(feature);
    if (nextFacility === null) {
      return selected;
    }

    if (!isPointInPolygon(nextFacility.coordinates, ring)) {
      return selected;
    }

    selected.push(nextFacility);
    return selected;
  }, []);
}

function initialPerspectiveSummary(): MeasurePerspectiveSelectionSummary {
  return {
    availablePowerMw: 0,
    commissionedPowerMw: 0,
    count: 0,
    leasedCount: 0,
    operationalCount: 0,
    pipelinePowerMw: 0,
    plannedCount: 0,
    plannedPowerMw: 0,
    squareFootage: 0,
    underConstructionCount: 0,
    underConstructionPowerMw: 0,
    unknownCount: 0,
  };
}

function buildPerspectiveSummary(
  facilities: readonly MeasureSelectedFacility[]
): MeasurePerspectiveSelectionSummary {
  return facilities.reduce<MeasurePerspectiveSelectionSummary>((summary, facility) => {
    const availablePowerMw =
      typeof facility.availablePowerMw === "number" ? facility.availablePowerMw : 0;
    const commissionedPowerMw =
      typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;
    const plannedPowerMw =
      typeof facility.plannedPowerMw === "number" ? facility.plannedPowerMw : 0;
    const squareFootage = typeof facility.squareFootage === "number" ? facility.squareFootage : 0;
    const underConstructionPowerMw =
      typeof facility.underConstructionPowerMw === "number" ? facility.underConstructionPowerMw : 0;

    const nextSummary: MeasurePerspectiveSelectionSummary = {
      availablePowerMw: summary.availablePowerMw + availablePowerMw,
      commissionedPowerMw: summary.commissionedPowerMw + commissionedPowerMw,
      count: summary.count + 1,
      leasedCount: summary.leasedCount,
      operationalCount: summary.operationalCount,
      pipelinePowerMw: summary.pipelinePowerMw + plannedPowerMw + underConstructionPowerMw,
      plannedCount: summary.plannedCount,
      plannedPowerMw: summary.plannedPowerMw + plannedPowerMw,
      squareFootage: summary.squareFootage + squareFootage,
      underConstructionCount: summary.underConstructionCount,
      underConstructionPowerMw: summary.underConstructionPowerMw + underConstructionPowerMw,
      unknownCount: summary.unknownCount,
    };

    if (facility.commissionedSemantic === "leased") {
      return {
        ...nextSummary,
        leasedCount: summary.leasedCount + 1,
      };
    }

    if (facility.commissionedSemantic === "operational") {
      return {
        ...nextSummary,
        operationalCount: summary.operationalCount + 1,
      };
    }

    if (facility.commissionedSemantic === "planned") {
      return {
        ...nextSummary,
        plannedCount: summary.plannedCount + 1,
      };
    }

    if (facility.commissionedSemantic === "under_construction") {
      return {
        ...nextSummary,
        underConstructionCount: summary.underConstructionCount + 1,
      };
    }

    return {
      ...nextSummary,
      unknownCount: summary.unknownCount + 1,
    };
  }, initialPerspectiveSummary());
}

function buildTopProviders(
  facilities: readonly MeasureSelectedFacility[]
): readonly MeasureProviderSummary[] {
  const providers = facilities.reduce<
    Map<string, { commissionedPowerMw: number; count: number; providerName: string }>
  >((lookup, facility) => {
    const current = lookup.get(facility.providerId) ?? {
      commissionedPowerMw: 0,
      count: 0,
      providerName: facility.providerName,
    };

    lookup.set(facility.providerId, {
      commissionedPowerMw:
        current.commissionedPowerMw +
        (typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0),
      count: current.count + 1,
      providerName: current.providerName,
    });

    return lookup;
  }, new Map<string, { commissionedPowerMw: number; count: number; providerName: string }>());

  return [...providers.entries()]
    .map(([providerId, summary]) => ({
      providerId,
      providerName: summary.providerName,
      count: summary.count,
      commissionedPowerMw: summary.commissionedPowerMw,
    }))
    .sort((left, right) => {
      if (right.commissionedPowerMw !== left.commissionedPowerMw) {
        return right.commissionedPowerMw - left.commissionedPowerMw;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (left.providerName !== right.providerName) {
        return left.providerName.localeCompare(right.providerName);
      }

      return left.providerId.localeCompare(right.providerId);
    })
    .slice(0, 5);
}

function normalizeCountyFips(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (COUNTY_FIPS_PATTERN.test(normalized)) {
    return normalized;
  }

  const geoidMatch = normalized.match(COUNTY_GEOID_PREFIX_PATTERN);
  return geoidMatch?.[1] ?? null;
}

function buildCountyIds(args: {
  readonly facilities: readonly MeasureSelectedFacility[];
  readonly parcels: readonly MeasureSelectedParcel[];
}): readonly string[] {
  const countyIds = new Set<string>();

  for (const facility of args.facilities) {
    const countyFips = normalizeCountyFips(facility.countyFips);
    if (countyFips !== null) {
      countyIds.add(countyFips);
    }
  }

  for (const parcel of args.parcels) {
    const countyFips = normalizeCountyFips(parcel.geoid);
    if (countyFips !== null) {
      countyIds.add(countyFips);
    }
  }

  return [...countyIds].sort((left, right) => left.localeCompare(right));
}

function csvCell(value: string | number | null): string {
  if (value === null) {
    return "";
  }

  const text = String(value);
  if (!(text.includes(",") || text.includes('"') || text.includes("\n"))) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export function formatMeasurePowerMw(powerMw: number): string {
  if (!Number.isFinite(powerMw)) {
    return "0 MW";
  }

  if (powerMw >= 1000) {
    return `${(powerMw / 1000).toFixed(2)} GW`;
  }

  return `${powerMw.toFixed(1)} MW`;
}

export function buildMeasureSelectionSummary(
  args: MeasureSelectionSummaryArgs
): MeasureSelectionSummary {
  const colocationFacilities = filterSelection(args.colocationFeatures, args.ring);
  const hyperscaleFacilities = filterSelection(args.hyperscaleFeatures, args.ring);
  const facilities = [...colocationFacilities, ...hyperscaleFacilities];
  const selectedParcels = args.parcelFeatures.map((feature) => toSelectedParcel(feature));
  selectedParcels.sort((left, right) => left.parcelId.localeCompare(right.parcelId));

  const parcelSelection: MeasureParcelSelectionSummary = {
    count: selectedParcels.length,
    parcels: selectedParcels,
    truncated: args.parcelTruncated,
    nextCursor: args.parcelNextCursor,
  };

  return {
    ring: args.ring.map((vertex) => [vertex[0], vertex[1]]),
    totalCount: facilities.length,
    countyIds: buildCountyIds({
      facilities,
      parcels: selectedParcels,
    }),
    facilities,
    parcelSelection,
    colocation: buildPerspectiveSummary(colocationFacilities),
    hyperscale: buildPerspectiveSummary(hyperscaleFacilities),
    topColocationProviders: buildTopProviders(colocationFacilities),
    topHyperscaleProviders: buildTopProviders(hyperscaleFacilities),
  };
}

export function buildMeasureSelectionCsv(summary: MeasureSelectionSummary): string {
  const header = [
    "Perspective",
    "Facility ID",
    "Facility Name",
    "Provider ID",
    "Provider Name",
    "State",
    "City",
    "Address",
    "County FIPS",
    "Commissioned Power (MW)",
    "Planned Power (MW)",
    "Under Construction Power (MW)",
    "Pipeline Power (MW)",
    "Available Power (MW)",
    "Square Footage",
    "Commissioned Semantic",
    "Status",
    "Lease Or Own",
    "Longitude",
    "Latitude",
  ];

  const rows = summary.facilities.map((facility) => [
    facility.perspective,
    facility.facilityId,
    facility.facilityName,
    facility.providerId,
    facility.providerName,
    facility.state ?? facility.stateAbbrev ?? "",
    facility.city ?? "",
    facility.address ?? "",
    facility.countyFips,
    facility.commissionedPowerMw,
    facility.plannedPowerMw,
    facility.underConstructionPowerMw,
    (facility.plannedPowerMw ?? 0) + (facility.underConstructionPowerMw ?? 0),
    facility.availablePowerMw,
    facility.squareFootage,
    facility.commissionedSemantic,
    facility.statusLabel ?? "",
    facility.leaseOrOwn ?? "",
    facility.coordinates[0],
    facility.coordinates[1],
  ]);

  return [header, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
}
