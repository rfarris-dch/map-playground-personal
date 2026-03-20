import type { CommissionedSemantic } from "@map-migration/geo-kernel/commissioned-semantic";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";

export type FacilityStatusFilterId = "commissioned" | "under-construction" | "planned" | "unknown";

export const FACILITY_STATUS_TO_SEMANTIC: Record<FacilityStatusFilterId, CommissionedSemantic[]> = {
  commissioned: ["leased", "operational"],
  "under-construction": ["under_construction"],
  planned: ["planned"],
  unknown: ["unknown"],
};

export type TransmissionVoltageFilterId = "ge-25" | "ge-50" | "ge-100" | "ge-230" | "ge-765";

export const VOLTAGE_THRESHOLDS: Record<TransmissionVoltageFilterId, number> = {
  "ge-25": 25,
  "ge-50": 50,
  "ge-100": 100,
  "ge-230": 230,
  "ge-765": 765,
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
  readonly activeMarkets: ReadonlySet<string>;
  readonly activeUsers: ReadonlySet<string>;
  readonly facilityProviders: ReadonlySet<string>;
  readonly facilityStatuses: ReadonlySet<FacilityStatusFilterId>;
  readonly floodZones: ReadonlySet<string>;
  readonly gasCapacities: ReadonlySet<string>;
  readonly gasStatuses: ReadonlySet<string>;
  readonly interconnectivityHub: boolean;
  readonly parcelAcresMax: number | null;
  readonly parcelAcresMin: number | null;
  readonly parcelDataset: string;
  readonly parcelDavPercent: string;
  readonly parcelStyleAcres: string;
  readonly powerTypes: ReadonlySet<string>;
  readonly transmissionMinVoltage: number | null;
  readonly zoningTypes: ReadonlySet<string>;
}

function cloneSet<T>(values: ReadonlySet<T>): ReadonlySet<T> {
  return new Set(values);
}

export function isFacilityStatusFilterId(value: string): value is FacilityStatusFilterId {
  return (
    value === "commissioned" ||
    value === "under-construction" ||
    value === "planned" ||
    value === "unknown"
  );
}

export function createDefaultMapFiltersState(): MapFiltersState {
  return {
    activeMarkets: new Set(),
    activeUsers: new Set(),
    facilityProviders: new Set(),
    facilityStatuses: new Set(),
    floodZones: new Set(),
    gasCapacities: new Set(),
    gasStatuses: new Set(),
    interconnectivityHub: false,
    parcelAcresMax: null,
    parcelAcresMin: null,
    parcelDataset: "",
    parcelDavPercent: "",
    parcelStyleAcres: "",
    powerTypes: new Set(),
    transmissionMinVoltage: null,
    zoningTypes: new Set(),
  };
}

export function cloneMapFiltersState(state: MapFiltersState): MapFiltersState {
  return {
    activeMarkets: cloneSet(state.activeMarkets),
    activeUsers: cloneSet(state.activeUsers),
    facilityProviders: cloneSet(state.facilityProviders),
    facilityStatuses: cloneSet(state.facilityStatuses),
    floodZones: cloneSet(state.floodZones),
    gasCapacities: cloneSet(state.gasCapacities),
    gasStatuses: cloneSet(state.gasStatuses),
    interconnectivityHub: state.interconnectivityHub,
    parcelAcresMax: state.parcelAcresMax,
    parcelAcresMin: state.parcelAcresMin,
    parcelDataset: state.parcelDataset,
    parcelDavPercent: state.parcelDavPercent,
    parcelStyleAcres: state.parcelStyleAcres,
    powerTypes: cloneSet(state.powerTypes),
    transmissionMinVoltage: state.transmissionMinVoltage,
    zoningTypes: cloneSet(state.zoningTypes),
  };
}

export type FacilitiesFeature = FacilitiesFeatureCollection["features"][number];

export type FacilitiesFilterPredicate = (feature: FacilitiesFeature) => boolean;
