import type { FacilityPerspective } from "@map-migration/contracts";
import { getQuerySpec } from "@map-migration/geo-sql";
import { runQuery } from "../../db/postgres";

export interface FacilitiesBboxQuery {
  readonly east: number;
  readonly limit: number;
  readonly north: number;
  readonly perspective: FacilityPerspective;
  readonly south: number;
  readonly west: number;
}

export interface FacilitiesBboxRow {
  readonly commissioned_semantic: string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly county_fips: string;
  readonly facility_id: string;
  readonly geom_json: unknown;
  readonly lease_or_own: string | null | undefined;
  readonly provider_id: string | null | undefined;
}

export interface FacilityDetailRow {
  readonly available_power_mw: number | string | null | undefined;
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly commissioned_semantic: string | null | undefined;
  readonly county_fips: string;
  readonly facility_id: string;
  readonly geom_json: unknown;
  readonly lease_or_own: string | null | undefined;
  readonly planned_power_mw: number | string | null | undefined;
  readonly provider_id: string | null | undefined;
  readonly under_construction_power_mw: number | string | null | undefined;
}

function getFacilitiesBboxQueryName(
  perspective: FacilityPerspective
): "facilities_bbox_colocation" | "facilities_bbox_hyperscale" {
  if (perspective === "hyperscale") {
    return "facilities_bbox_hyperscale";
  }

  return "facilities_bbox_colocation";
}

export function getFacilitiesBboxMaxRows(perspective: FacilityPerspective): number {
  const spec = getQuerySpec(getFacilitiesBboxQueryName(perspective));
  return spec.maxRows;
}

function getFacilityDetailQueryName(
  perspective: FacilityPerspective
): "facility_detail_colocation" | "facility_detail_hyperscale" {
  if (perspective === "hyperscale") {
    return "facility_detail_hyperscale";
  }

  return "facility_detail_colocation";
}

export function listFacilitiesByBbox(query: FacilitiesBboxQuery): Promise<FacilitiesBboxRow[]> {
  const spec = getQuerySpec(getFacilitiesBboxQueryName(query.perspective));

  return runQuery<FacilitiesBboxRow>(spec.sql, [
    query.west,
    query.south,
    query.east,
    query.north,
    query.limit,
  ]);
}

export async function getFacilityById(
  facilityId: string,
  perspective: FacilityPerspective
): Promise<FacilityDetailRow | null> {
  const spec = getQuerySpec(getFacilityDetailQueryName(perspective));
  const rows = await runQuery<FacilityDetailRow>(spec.sql, [facilityId]);
  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    return null;
  }

  return firstRow;
}
