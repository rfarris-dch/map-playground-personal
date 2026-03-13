import type { CommissionedSemantic, FacilitiesFeatureCollection } from "@map-migration/contracts";

/**
 * Facility status filter IDs map to CommissionedSemantic values.
 * "commissioned" covers both "leased" and "operational".
 */
export type FacilityStatusFilterId = "commissioned" | "under-construction" | "planned" | "unknown";

/**
 * Maps filter panel status IDs to CommissionedSemantic values.
 */
export const FACILITY_STATUS_TO_SEMANTIC: Record<FacilityStatusFilterId, CommissionedSemantic[]> = {
  commissioned: ["leased", "operational"],
  "under-construction": ["under_construction"],
  planned: ["planned"],
  unknown: ["unknown"],
};

/**
 * Minimum voltage thresholds in volts for transmission line filtering.
 */
export type TransmissionVoltageFilterId = "ge-25" | "ge-50" | "ge-100" | "ge-230" | "ge-765";

export const VOLTAGE_THRESHOLDS: Record<TransmissionVoltageFilterId, number> = {
  "ge-25": 25_000,
  "ge-50": 50_000,
  "ge-100": 100_000,
  "ge-230": 230_000,
  "ge-765": 765_000,
};

export interface MapFiltersState {
  /** Active provider name filters. Empty = show all. */
  readonly facilityProviders: ReadonlySet<string>;
  /** Active facility status filters. Empty = show all. */
  readonly facilityStatuses: ReadonlySet<FacilityStatusFilterId>;

  /** Minimum transmission voltage threshold in volts, or null = show all. */
  readonly transmissionMinVoltage: number | null;
}

export type FacilitiesFeature = FacilitiesFeatureCollection["features"][number];

export type FacilitiesFilterPredicate = (feature: FacilitiesFeature) => boolean;
