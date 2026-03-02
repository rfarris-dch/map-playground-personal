import type {
  CommissionedSemantic,
  FacilitiesDetailFeature,
  FacilitiesFeature,
  FacilityPerspective,
  LeaseOrOwn,
} from "@map-migration/contracts";
import type { FacilitiesBboxRow, FacilityDetailRow } from "./facilities.repo";

interface PointGeometry {
  readonly coordinates: [number, number];
  readonly type: "Point";
}

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid geom_json: not valid JSON");
  }
}

function assertObject(input: unknown): asserts input is object {
  if (typeof input !== "object" || input === null) {
    throw new Error("Invalid geom_json: not an object");
  }
}

function readCoordinates(input: unknown): [number, number] {
  if (!Array.isArray(input) || input.length !== 2) {
    throw new Error("Invalid geom_json: expected [lng, lat]");
  }

  const lng = Number(input[0]);
  const lat = Number(input[1]);
  if (!(Number.isFinite(lng) && Number.isFinite(lat))) {
    throw new Error("Invalid geom_json: coordinates are not finite numbers");
  }

  return [lng, lat];
}

function parsePointGeometry(input: unknown): PointGeometry {
  const value = typeof input === "string" ? parseJsonObject(input) : input;
  assertObject(value);

  const type = Reflect.get(value, "type");
  const coordinates = Reflect.get(value, "coordinates");

  if (type !== "Point") {
    throw new Error("Invalid geom_json: geometry type must be Point");
  }

  return {
    type: "Point",
    coordinates: readCoordinates(coordinates),
  };
}

function readNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readCommissionedSemantic(value: string | null | undefined): CommissionedSemantic {
  if (
    value === "leased" ||
    value === "operational" ||
    value === "under_construction" ||
    value === "planned" ||
    value === "unknown"
  ) {
    return value;
  }

  return "unknown";
}

function readLeaseOrOwn(value: string | null | undefined): LeaseOrOwn | null {
  if (value === "lease" || value === "own" || value === "unknown") {
    return value;
  }

  return null;
}

function readProviderId(value: string | null | undefined): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return "unknown-provider";
}

export function mapFacilitiesRowsToFeatures(
  rows: readonly FacilitiesBboxRow[],
  perspective: FacilityPerspective
): FacilitiesFeature[] {
  return rows.map((row) => ({
    type: "Feature",
    id: row.facility_id,
    geometry: parsePointGeometry(row.geom_json),
    properties: {
      perspective,
      facilityId: row.facility_id,
      providerId: readProviderId(row.provider_id),
      countyFips: row.county_fips,
      commissionedPowerMw: readNullableNumber(row.commissioned_power_mw),
      commissionedSemantic: readCommissionedSemantic(row.commissioned_semantic),
      leaseOrOwn: readLeaseOrOwn(row.lease_or_own),
    },
  }));
}

export function mapFacilityDetailRowToFeature(
  row: FacilityDetailRow,
  perspective: FacilityPerspective
): FacilitiesDetailFeature {
  return {
    type: "Feature",
    id: row.facility_id,
    geometry: parsePointGeometry(row.geom_json),
    properties: {
      perspective,
      facilityId: row.facility_id,
      providerId: readProviderId(row.provider_id),
      countyFips: row.county_fips,
      commissionedSemantic: readCommissionedSemantic(row.commissioned_semantic),
      leaseOrOwn: readLeaseOrOwn(row.lease_or_own),
      commissionedPowerMw: readNullableNumber(row.commissioned_power_mw),
      plannedPowerMw: readNullableNumber(row.planned_power_mw),
      underConstructionPowerMw: readNullableNumber(row.under_construction_power_mw),
      availablePowerMw: readNullableNumber(row.available_power_mw),
    },
  };
}
