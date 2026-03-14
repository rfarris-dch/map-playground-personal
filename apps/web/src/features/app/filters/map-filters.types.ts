import type { CommissionedSemantic } from "@map-migration/geo-kernel/commissioned-semantic";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";

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

export type PowerTypeFilterId = "commissioned" | "available" | "under-construction" | "planned";
export type GasCapacityFilterId = "0-10" | "25-100" | "100-500" | "500-1000" | "1000+";
export type GasStatusFilterId =
  | "operating"
  | "proposed"
  | "announced"
  | "discontinued"
  | "in-development";
export type ZoningTypeFilterId =
  | "residential"
  | "commercial"
  | "industrial"
  | "agriculture"
  | "exempt"
  | "farmland"
  | "mixed"
  | "unzoned";
export type FloodZoneFilterId = "low-risk" | "high-risk" | "coastal-high-risk";

export interface MapFiltersState {
  /** Active market filters. Empty = show all. */
  readonly activeMarkets: ReadonlySet<string>;
  /** Active user filters. Empty = show all. */
  readonly activeUsers: ReadonlySet<string>;
  /** Active provider name filters. Empty = show all. */
  readonly facilityProviders: ReadonlySet<string>;
  /** Active facility status filters. Empty = show all. */
  readonly facilityStatuses: ReadonlySet<FacilityStatusFilterId>;
  /** Active flood zone filters. Empty = show all. */
  readonly floodZones: ReadonlySet<string>;
  /** Active gas capacity filters. Empty = show all. */
  readonly gasCapacities: ReadonlySet<string>;
  /** Active gas status filters. Empty = show all. */
  readonly gasStatuses: ReadonlySet<string>;
  /** Whether the interconnectivity hub filter is enabled. */
  readonly interconnectivityHub: boolean;
  /** Selected parcel dataset value. */
  readonly parcelDataset: string;
  /** Selected parcel DAV percent value. */
  readonly parcelDavPercent: string;
  /** Selected parcel style (acres) value. */
  readonly parcelStyleAcres: string;
  /** Active power type filters. Empty = show all. */
  readonly powerTypes: ReadonlySet<string>;

  /** Minimum transmission voltage threshold in volts, or null = show all. */
  readonly transmissionMinVoltage: number | null;
  /** Active zoning type filters. Empty = show all. */
  readonly zoningTypes: ReadonlySet<string>;
}

export type FacilitiesFeature = FacilitiesFeatureCollection["features"][number];

export type FacilitiesFilterPredicate = (feature: FacilitiesFeature) => boolean;
