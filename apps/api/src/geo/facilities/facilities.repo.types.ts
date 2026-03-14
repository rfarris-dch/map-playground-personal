import type { FacilityPerspective } from "@map-migration/geo-kernel";
import type { FacilitySortBy, SortDirection } from "@map-migration/http-contracts";

export interface FacilityTableRow {
  readonly available_power_mw: number | string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly commissioned_semantic: string | null | undefined;
  readonly facility_id: string | number;
  readonly facility_name: string | null | undefined;
  readonly lease_or_own: string | null | undefined;
  readonly planned_power_mw: number | string | null | undefined;
  readonly provider_id: string | null | undefined;
  readonly state_abbrev: string | null | undefined;
  readonly under_construction_power_mw: number | string | null | undefined;
  readonly updated_at: Date | string | null | undefined;
}

export interface FacilityDetailRow {
  readonly address: string | null | undefined;
  readonly available_power_mw: number | string | null | undefined;
  readonly city: string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly commissioned_semantic: string | null | undefined;
  readonly county_fips: string;
  readonly facility_id: string;
  readonly facility_name: string | null | undefined;
  readonly geom_json: unknown;
  readonly lease_or_own: string | null | undefined;
  readonly planned_power_mw: number | string | null | undefined;
  readonly provider_id: string | null | undefined;
  readonly provider_name: string | null | undefined;
  readonly square_footage: number | string | null | undefined;
  readonly state: string | null | undefined;
  readonly state_abbrev: string | null | undefined;
  readonly status_label: string | null | undefined;
  readonly under_construction_power_mw: number | string | null | undefined;
}

export interface FacilitiesBboxRow {
  readonly address: string | null | undefined;
  readonly available_power_mw: number | string | null | undefined;
  readonly city: string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly commissioned_semantic: string | null | undefined;
  readonly county_fips: string;
  readonly facility_id: string;
  readonly facility_name: string | null | undefined;
  readonly geom_json: unknown;
  readonly lease_or_own: string | null | undefined;
  readonly planned_power_mw: number | string | null | undefined;
  readonly provider_id: string | null | undefined;
  readonly provider_name: string | null | undefined;
  readonly square_footage: number | string | null | undefined;
  readonly state: string | null | undefined;
  readonly state_abbrev: string | null | undefined;
  readonly status_label: string | null | undefined;
  readonly under_construction_power_mw: number | string | null | undefined;
}

export interface FacilityTableCountRow {
  readonly total_count: number | string;
}

export interface FacilitiesPolygonQuery {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export interface FacilitiesTableQuery {
  readonly limit: number;
  readonly offset: number;
  readonly perspective: FacilityPerspective;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export interface FacilitiesBboxQuery {
  readonly east: number;
  readonly limit: number;
  readonly north: number;
  readonly perspective: FacilityPerspective;
  readonly south: number;
  readonly west: number;
}
