import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import {
  buildFacilitiesBboxQuery,
  buildFacilitiesPolygonQuery,
  buildFacilityDetailQuery,
  getFacilitiesBboxQuerySpec,
  getFacilitiesPolygonQuerySpec,
} from "@map-migration/geo-sql";
import type { FacilitySortBy } from "@map-migration/http-contracts/table-contracts";
import { runQuery } from "@/db/postgres";
import type {
  FacilitiesBboxQuery,
  FacilitiesBboxRow,
  FacilitiesPolygonQuery,
  FacilitiesTableQuery,
  FacilityDetailRow,
  FacilityTableCountRow,
  FacilityTableRow,
} from "./facilities.repo.types";

export type {
  FacilitiesBboxRow,
  FacilityDetailRow,
  FacilityTableRow,
} from "./facilities.repo.types";

function parseCount(value: number | string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Invalid facility count value from database");
  }

  return Math.trunc(numeric);
}

export function getFacilitiesBboxMaxRows(perspective: FacilityPerspective): number {
  return getFacilitiesBboxQuerySpec(perspective).maxRows;
}

export function getFacilitiesPolygonMaxRows(perspective: FacilityPerspective): number {
  return getFacilitiesPolygonQuerySpec(perspective).maxRows;
}

export function listFacilitiesByBbox(query: FacilitiesBboxQuery): Promise<FacilitiesBboxRow[]> {
  const sqlQuery = buildFacilitiesBboxQuery(query);

  return runQuery<FacilitiesBboxRow>(sqlQuery.sql, sqlQuery.params);
}

export function listFacilitiesByPolygon(
  query: FacilitiesPolygonQuery
): Promise<FacilitiesBboxRow[]> {
  const sqlQuery = buildFacilitiesPolygonQuery(query);
  return runQuery<FacilitiesBboxRow>(sqlQuery.sql, sqlQuery.params);
}

export async function getFacilityById(
  facilityId: string,
  perspective: FacilityPerspective
): Promise<FacilityDetailRow | null> {
  const sqlQuery = buildFacilityDetailQuery({
    facilityId,
    perspective,
  });
  const rows = await runQuery<FacilityDetailRow>(sqlQuery.sql, sqlQuery.params);
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
  facility.hyperscale_id AS facility_id,
  facility.facility_name,
  facility.provider_id,
  COALESCE(
    NULLIF(BTRIM(facility.facility_name), ''),
    NULLIF(BTRIM(provider.provider_name), ''),
    facility.provider_id
  ) AS provider_name,
  facility.state_abbrev,
  facility.commissioned_semantic,
  facility.lease_or_own,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  NULL::numeric AS available_power_mw,
  facility.freshness_ts AS updated_at
FROM serve.hyperscale_site AS facility
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = facility.provider_id
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
  facility.facility_id,
  facility.facility_name,
  facility.provider_id,
  COALESCE(
    NULLIF(BTRIM(provider.provider_name), ''),
    NULLIF(INITCAP(REPLACE(facility.provider_slug, '-', ' ')), ''),
    facility.provider_id
  ) AS provider_name,
  facility.state_abbrev,
  facility.commissioned_semantic,
  NULL::text AS lease_or_own,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  facility.freshness_ts AS updated_at
FROM serve.facility_site AS facility
LEFT JOIN facility_current.providers AS provider
  ON provider.provider_id = facility.provider_id
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, facility_name ASC, facility_id ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}
