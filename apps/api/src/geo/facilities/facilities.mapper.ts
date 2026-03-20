import {
  type CommissionedSemantic,
  type LeaseOrOwn,
  parseCommissionedSemantic,
  parseLeaseOrOwn,
} from "@map-migration/geo-kernel/commissioned-semantic";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { type Geometry, GeometrySchema } from "@map-migration/geo-kernel/geometry";
import type {
  FacilitiesDetailFeature,
  FacilitiesFeature,
} from "@map-migration/http-contracts/facilities-http";
import type { FacilitiesBboxRow, FacilityDetailRow } from "@/geo/facilities/facilities.repo";
import type { PointGeometry } from "./facilities.mapper.types";

const NUMERIC_IDENTIFIER_RE = /^[0-9]+$/;

function parseJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid geom_json: not valid JSON");
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

function parseGeometry(input: unknown): Geometry {
  const value = typeof input === "string" ? parseJsonObject(input) : input;
  const parsed = GeometrySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid geom_json: ${parsed.error.issues[0]?.message ?? "unknown geometry"}`);
  }
  return parsed.data;
}

function parsePointGeometry(input: unknown): PointGeometry {
  const geom = parseGeometry(input);
  if (geom.type !== "Point") {
    throw new Error("Invalid geom_json: geometry type must be Point");
  }
  return geom;
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
  return parseCommissionedSemantic(value) ?? "unknown";
}

function readLeaseOrOwn(value: string | null | undefined): LeaseOrOwn | null {
  return parseLeaseOrOwn(value);
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readRequiredText(value: string | null | undefined, field: string): string {
  const normalized = readNullableText(value);
  if (normalized === null) {
    throw new Error(`Invalid facilities row: missing ${field}`);
  }

  return normalized;
}

function readFacilityName(value: string | null | undefined): string {
  return readRequiredText(value, "facility_name");
}

function readProviderName(args: {
  readonly facilityName: string | null | undefined;
  readonly perspective: FacilityPerspective;
  readonly providerId: string | null | undefined;
  readonly providerName: string | null | undefined;
}): string {
  const resolvedProviderName = readNullableText(args.providerName);
  const resolvedProviderId = readNullableText(args.providerId);
  if (resolvedProviderName !== null) {
    const providerLooksLikeId =
      resolvedProviderName === resolvedProviderId ||
      NUMERIC_IDENTIFIER_RE.test(resolvedProviderName);
    if (!(args.perspective === "hyperscale" && providerLooksLikeId)) {
      return resolvedProviderName;
    }
  }

  if (args.perspective === "hyperscale") {
    const fallbackFromFacilityName = readFacilityName(args.facilityName);
    return fallbackFromFacilityName;
  }

  if (resolvedProviderName !== null) {
    return resolvedProviderName;
  }

  if (resolvedProviderId !== null && !NUMERIC_IDENTIFIER_RE.test(resolvedProviderId)) {
    return resolvedProviderId;
  }

  throw new Error("Invalid facilities row: provider_name is required");
}

function readProviderId(value: string | null | undefined): string {
  return readNullableText(value) ?? "unknown";
}

export function mapFacilitiesRowsToFeatures(
  rows: readonly FacilitiesBboxRow[],
  perspective: FacilityPerspective
): FacilitiesFeature[] {
  return rows.map((row) => ({
    type: "Feature",
    id: row.facility_id,
    geometry: parseGeometry(row.geom_json),
    properties: {
      perspective,
      facilityId: row.facility_id,
      facilityName: readFacilityName(row.facility_name),
      providerId: readProviderId(row.provider_id),
      providerName: readProviderName({
        providerName: row.provider_name,
        providerId: row.provider_id,
        facilityName: row.facility_name,
        perspective,
      }),
      countyFips: row.county_fips,
      stateAbbrev: readNullableText(row.state_abbrev),
      commissionedPowerMw: readNullableNumber(row.commissioned_power_mw),
      plannedPowerMw: readNullableNumber(row.planned_power_mw),
      underConstructionPowerMw: readNullableNumber(row.under_construction_power_mw),
      availablePowerMw: readNullableNumber(row.available_power_mw),
      squareFootage: readNullableNumber(row.square_footage),
      commissionedSemantic: readCommissionedSemantic(row.commissioned_semantic),
      leaseOrOwn: readLeaseOrOwn(row.lease_or_own),
      statusLabel: readNullableText(row.status_label),
      facilityCode: readNullableText(row.facility_code),
      address: readNullableText(row.address),
      city: readNullableText(row.city),
      state: readNullableText(row.state),
      marketName: readNullableText(row.market_name),
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
      facilityName: readFacilityName(row.facility_name),
      providerId: readProviderId(row.provider_id),
      providerName: readProviderName({
        providerName: row.provider_name,
        providerId: row.provider_id,
        facilityName: row.facility_name,
        perspective,
      }),
      countyFips: row.county_fips,
      stateAbbrev: readNullableText(row.state_abbrev),
      commissionedSemantic: readCommissionedSemantic(row.commissioned_semantic),
      leaseOrOwn: readLeaseOrOwn(row.lease_or_own),
      commissionedPowerMw: readNullableNumber(row.commissioned_power_mw),
      plannedPowerMw: readNullableNumber(row.planned_power_mw),
      underConstructionPowerMw: readNullableNumber(row.under_construction_power_mw),
      availablePowerMw: readNullableNumber(row.available_power_mw),
      squareFootage: readNullableNumber(row.square_footage),
      statusLabel: readNullableText(row.status_label),
      facilityCode: readNullableText(row.facility_code),
      address: readNullableText(row.address),
      city: readNullableText(row.city),
      state: readNullableText(row.state),
      marketName: readNullableText(row.market_name),
    },
  };
}
