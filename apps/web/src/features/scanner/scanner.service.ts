import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import type {
  ScannerFacility,
  ScannerInput,
  ScannerParcel,
  ScannerParcelSelectionSummary,
  ScannerPerspectiveSummary,
  ScannerProviderSummary,
  ScannerSummary,
} from "@/features/scanner/scanner.types";

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

function readNullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableText(value: string | null | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function readPointCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const lng = value[0];
  const lat = value[1];
  if (
    typeof lng !== "number" ||
    !Number.isFinite(lng) ||
    typeof lat !== "number" ||
    !Number.isFinite(lat)
  ) {
    return null;
  }

  return [lng, lat];
}

function toScannerFacility(
  feature: FacilitiesFeatureCollection["features"][number]
): ScannerFacility | null {
  const coordinates = readPointCoordinates(feature.geometry.coordinates);
  if (coordinates === null) {
    return null;
  }

  return {
    address: readNullableText(feature.properties.address),
    availablePowerMw: readNullableNumber(feature.properties.availablePowerMw),
    city: readNullableText(feature.properties.city),
    countyFips: normalizeCountyFips(feature.properties.countyFips),
    perspective: feature.properties.perspective,
    facilityId: feature.properties.facilityId,
    facilityName: resolveDisplayName(feature.properties.facilityName, "Unknown facility"),
    providerId: feature.properties.providerId,
    providerName: resolveDisplayName(feature.properties.providerName, "Unknown provider"),
    commissionedPowerMw: readNullableNumber(feature.properties.commissionedPowerMw),
    commissionedSemantic: feature.properties.commissionedSemantic,
    leaseOrOwn: feature.properties.leaseOrOwn,
    plannedPowerMw: readNullableNumber(feature.properties.plannedPowerMw),
    coordinates,
    squareFootage: readNullableNumber(feature.properties.squareFootage),
    state: readNullableText(feature.properties.state),
    stateAbbrev: feature.properties.stateAbbrev,
    statusLabel: readNullableText(feature.properties.statusLabel),
    underConstructionPowerMw: readNullableNumber(feature.properties.underConstructionPowerMw),
  };
}

function toScannerParcel(feature: ParcelsFeatureCollection["features"][number]): ScannerParcel {
  let coordinates: [number, number] | null = null;
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

function initialPerspectiveSummary(): ScannerPerspectiveSummary {
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
  facilities: readonly ScannerFacility[]
): ScannerPerspectiveSummary {
  return facilities.reduce<ScannerPerspectiveSummary>((summary, facility) => {
    const availablePowerMw =
      typeof facility.availablePowerMw === "number" ? facility.availablePowerMw : 0;
    const commissionedPowerMw =
      typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;
    const plannedPowerMw =
      typeof facility.plannedPowerMw === "number" ? facility.plannedPowerMw : 0;
    const squareFootage = typeof facility.squareFootage === "number" ? facility.squareFootage : 0;
    const underConstructionPowerMw =
      typeof facility.underConstructionPowerMw === "number" ? facility.underConstructionPowerMw : 0;

    const nextSummary: ScannerPerspectiveSummary = {
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
  facilities: readonly ScannerFacility[]
): readonly ScannerProviderSummary[] {
  const providers = facilities.reduce<Map<string, { commissionedPowerMw: number; count: number }>>(
    (lookup, facility) => {
      const key = facility.providerName;
      const current = lookup.get(key) ?? {
        commissionedPowerMw: 0,
        count: 0,
      };

      lookup.set(key, {
        commissionedPowerMw:
          current.commissionedPowerMw +
          (typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0),
        count: current.count + 1,
      });

      return lookup;
    },
    new Map<string, { commissionedPowerMw: number; count: number }>()
  );

  return [...providers.entries()]
    .map(([providerName, summary]) => ({
      providerName,
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

      return left.providerName.localeCompare(right.providerName);
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
  readonly facilities: readonly ScannerFacility[];
  readonly parcels: readonly ScannerParcel[];
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

export function formatScannerPowerMw(powerMw: number): string {
  if (!Number.isFinite(powerMw)) {
    return "0 MW";
  }

  if (powerMw >= 1000) {
    return `${(powerMw / 1000).toFixed(2)} GW`;
  }

  return `${powerMw.toFixed(1)} MW`;
}

export function buildScannerSummary(input: ScannerInput): ScannerSummary {
  const colocationFacilities = input.colocationFeatures
    .map((feature) => toScannerFacility(feature))
    .filter((facility): facility is ScannerFacility => facility !== null);
  const hyperscaleFacilities = input.hyperscaleFeatures
    .map((feature) => toScannerFacility(feature))
    .filter((facility): facility is ScannerFacility => facility !== null);

  const facilities = [...colocationFacilities, ...hyperscaleFacilities];
  facilities.sort((left, right) => {
    if (left.perspective !== right.perspective) {
      return left.perspective === "colocation" ? -1 : 1;
    }

    const leftPower = left.commissionedPowerMw ?? -1;
    const rightPower = right.commissionedPowerMw ?? -1;
    if (rightPower !== leftPower) {
      return rightPower - leftPower;
    }

    return left.facilityName.localeCompare(right.facilityName);
  });
  const parcels = input.parcelFeatures.map((feature) => toScannerParcel(feature));
  parcels.sort((left, right) => left.parcelId.localeCompare(right.parcelId));

  const parcelSelection: ScannerParcelSelectionSummary = {
    count: parcels.length,
    parcels,
    truncated: input.parcelTruncated,
    nextCursor: input.parcelNextCursor,
  };

  return {
    totalCount: facilities.length,
    countyIds: buildCountyIds({
      facilities,
      parcels,
    }),
    facilities,
    colocation: buildPerspectiveSummary(colocationFacilities),
    hyperscale: buildPerspectiveSummary(hyperscaleFacilities),
    parcelSelection,
    topColocationProviders: buildTopProviders(colocationFacilities),
    topHyperscaleProviders: buildTopProviders(hyperscaleFacilities),
  };
}

export function buildScannerCsv(summary: ScannerSummary): string {
  const header = [
    "Perspective",
    "Facility",
    "Provider",
    "State",
    "City",
    "Address",
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
    facility.facilityName,
    facility.providerName,
    facility.state ?? facility.stateAbbrev ?? "",
    facility.city ?? "",
    facility.address ?? "",
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
