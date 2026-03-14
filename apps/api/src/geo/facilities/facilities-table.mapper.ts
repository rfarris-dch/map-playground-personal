import {
  type CommissionedSemantic,
  type FacilityPerspective,
  type LeaseOrOwn,
  parseCommissionedSemantic,
  parseLeaseOrOwn,
} from "@map-migration/geo-kernel";
import type { FacilityTableRow as FacilityTableRowContract } from "@map-migration/http-contracts";
import type { FacilityTableRow as FacilityTableRowRepo } from "@/geo/facilities/facilities.repo";

function readNullableNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function readRequiredText(value: string | null | undefined, field: string): string {
  const parsed = readNullableText(value);
  if (parsed === null) {
    throw new Error(`Missing required facility field: ${field}`);
  }

  return parsed;
}

function readCommissionedSemantic(value: string | null | undefined): CommissionedSemantic {
  return parseCommissionedSemantic(value) ?? "unknown";
}

function readLeaseOrOwn(value: string | null | undefined): LeaseOrOwn | null {
  return parseLeaseOrOwn(value);
}

function readNullableTimestamp(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return readNullableText(value ?? null);
}

export function mapFacilitiesTableRows(
  rows: readonly FacilityTableRowRepo[],
  perspective: FacilityPerspective
): FacilityTableRowContract[] {
  return rows.map((row) => ({
    perspective,
    facilityId: String(row.facility_id),
    facilityName: readRequiredText(row.facility_name, "facility_name"),
    providerId: readNullableText(row.provider_id),
    stateAbbrev: readNullableText(row.state_abbrev),
    commissionedSemantic: readCommissionedSemantic(row.commissioned_semantic),
    leaseOrOwn: readLeaseOrOwn(row.lease_or_own),
    commissionedPowerMw: readNullableNumber(row.commissioned_power_mw),
    plannedPowerMw: readNullableNumber(row.planned_power_mw),
    underConstructionPowerMw: readNullableNumber(row.under_construction_power_mw),
    availablePowerMw: readNullableNumber(row.available_power_mw),
    updatedAt: readNullableTimestamp(row.updated_at),
  }));
}
