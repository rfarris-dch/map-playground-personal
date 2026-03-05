import type {
  FacilitiesFeatureCollection,
  ParcelsFeatureCollection,
} from "@map-migration/contracts";
import type {
  ScannerFacility,
  ScannerInput,
  ScannerParcel,
  ScannerParcelSelectionSummary,
  ScannerPerspectiveSummary,
  ScannerProviderSummary,
  ScannerSummary,
} from "@/features/scanner/scanner.types";

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
    perspective: feature.properties.perspective,
    facilityId: feature.properties.facilityId,
    facilityName: feature.properties.facilityName,
    providerName: feature.properties.providerName,
    commissionedPowerMw: feature.properties.commissionedPowerMw,
    commissionedSemantic: feature.properties.commissionedSemantic,
    leaseOrOwn: feature.properties.leaseOrOwn,
    coordinates,
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
    commissionedPowerMw: 0,
    count: 0,
    leasedCount: 0,
    operationalCount: 0,
    plannedCount: 0,
    underConstructionCount: 0,
    unknownCount: 0,
  };
}

function buildPerspectiveSummary(
  facilities: readonly ScannerFacility[]
): ScannerPerspectiveSummary {
  return facilities.reduce<ScannerPerspectiveSummary>((summary, facility) => {
    const commissionedPowerMw =
      typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;

    const nextSummary: ScannerPerspectiveSummary = {
      commissionedPowerMw: summary.commissionedPowerMw + commissionedPowerMw,
      count: summary.count + 1,
      leasedCount: summary.leasedCount,
      operationalCount: summary.operationalCount,
      plannedCount: summary.plannedCount,
      underConstructionCount: summary.underConstructionCount,
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
    "Commissioned Power (MW)",
    "Commissioned Semantic",
    "Lease Or Own",
    "Longitude",
    "Latitude",
  ];

  const rows = summary.facilities.map((facility) => [
    facility.perspective,
    facility.facilityName,
    facility.providerName,
    facility.commissionedPowerMw,
    facility.commissionedSemantic,
    facility.leaseOrOwn ?? "",
    facility.coordinates[0],
    facility.coordinates[1],
  ]);

  return [header, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
}
