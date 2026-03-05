import type { FacilityPerspective, FacilitySortBy, SortDirection } from "@map-migration/contracts";
import { getQuerySpec } from "@map-migration/geo-sql";
import { runQuery } from "../../db/postgres";

interface FacilitiesBboxQuery {
  readonly east: number;
  readonly limit: number;
  readonly north: number;
  readonly perspective: FacilityPerspective;
  readonly south: number;
  readonly west: number;
}

interface FacilitiesTableQuery {
  readonly limit: number;
  readonly offset: number;
  readonly perspective: FacilityPerspective;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

interface FacilityTableCountRow {
  readonly total_count: number | string;
}

export interface FacilitiesBboxRow {
  readonly commissioned_power_mw: number | string | null | undefined;
  readonly commissioned_semantic: string | null | undefined;
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

function parseCount(value: number | string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Invalid facility count value from database");
  }

  return Math.trunc(numeric);
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

export async function countFacilitiesTableRows(perspective: FacilityPerspective): Promise<number> {
  if (perspective === "hyperscale") {
    const rows = await runQuery<FacilityTableCountRow>(
      `
SELECT
  COUNT(*)::bigint AS total_count
FROM serve.hyperscale_site;
`,
      []
    );
    const firstRow = rows[0];
    if (typeof firstRow === "undefined") {
      return 0;
    }

    return parseCount(firstRow.total_count);
  }

  const rows = await runQuery<FacilityTableCountRow>(
    `
SELECT
  COUNT(*)::bigint AS total_count
FROM serve.facility_site;
`,
    []
  );
  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    return 0;
  }

  return parseCount(firstRow.total_count);
}

const facilitySortSqlByField: Record<FacilitySortBy, string> = {
  facilityName: "facility_name",
  providerId: "provider_id",
  stateAbbrev: "state_abbrev",
  commissionedSemantic: "commissioned_semantic",
  leaseOrOwn: "lease_or_own",
  commissionedPowerMw: "commissioned_power_mw",
  plannedPowerMw: "planned_power_mw",
  underConstructionPowerMw: "under_construction_power_mw",
  availablePowerMw: "available_power_mw",
  updatedAt: "updated_at",
};

export function listFacilitiesTableRows(query: FacilitiesTableQuery): Promise<FacilityTableRow[]> {
  const sortColumn = facilitySortSqlByField[query.sortBy];
  const sortDirection = query.sortOrder === "desc" ? "DESC" : "ASC";

  if (query.perspective === "hyperscale") {
    return runQuery<FacilityTableRow>(
      `
SELECT
  hyperscale_id AS facility_id,
  facility_name,
  provider_id,
  state_abbrev,
  commissioned_semantic,
  lease_or_own,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  freshness_ts AS updated_at
FROM serve.hyperscale_site
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, facility_name ASC, facility_id ASC
LIMIT $1
OFFSET $2;
`,
      [query.limit, query.offset]
    );
  }

  return runQuery<FacilityTableRow>(
    `
SELECT
  facility_id,
  facility_name,
  provider_id,
  state_abbrev,
  commissioned_semantic,
  NULL::text AS lease_or_own,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  freshness_ts AS updated_at
FROM serve.facility_site
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, facility_name ASC, facility_id ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}
