import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import {
  buildFacilitiesBboxQuery,
  buildFacilitiesPolygonQuery,
  buildFacilityDetailQuery,
  type FacilitiesDatasetSqlTables,
  getFacilitiesBboxQuerySpec,
  getFacilitiesPolygonQuerySpec,
} from "@map-migration/geo-sql";
import type { FacilitySortBy } from "@map-migration/http-contracts/table-contracts";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
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

const DEFAULT_FACILITIES_INTERACTIVE_QUERY_STATEMENT_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_FACILITIES_INTERACTIVE_QUERY_STATEMENT_TIMEOUT_MS,
  15_000
);
const DEFAULT_FACILITIES_HEAVY_QUERY_STATEMENT_TIMEOUT_MS = parsePositiveIntFlag(
  process.env.API_FACILITIES_HEAVY_QUERY_STATEMENT_TIMEOUT_MS,
  45_000
);

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

  return runQuery<FacilitiesBboxRow>(sqlQuery.sql, sqlQuery.params, {
    queryClass: "facilities-interactive",
    statementTimeoutMs: DEFAULT_FACILITIES_INTERACTIVE_QUERY_STATEMENT_TIMEOUT_MS,
  });
}

export function listFacilitiesByPolygon(
  query: FacilitiesPolygonQuery
): Promise<FacilitiesBboxRow[]> {
  const sqlQuery = buildFacilitiesPolygonQuery(query);
  return runQuery<FacilitiesBboxRow>(sqlQuery.sql, sqlQuery.params, {
    queryClass: "facilities-heavy",
    statementTimeoutMs: DEFAULT_FACILITIES_HEAVY_QUERY_STATEMENT_TIMEOUT_MS,
  });
}

export async function getFacilityById(
  facilityId: string,
  perspective: FacilityPerspective,
  tables: FacilitiesDatasetSqlTables
): Promise<FacilityDetailRow | null> {
  const sqlQuery = buildFacilityDetailQuery({
    facilityId,
    perspective,
    tables,
  });
  const rows = await runQuery<FacilityDetailRow>(sqlQuery.sql, sqlQuery.params, {
    queryClass: "facilities-interactive",
    statementTimeoutMs: DEFAULT_FACILITIES_INTERACTIVE_QUERY_STATEMENT_TIMEOUT_MS,
  });
  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    return null;
  }

  return firstRow;
}

function resolveFacilitiesTableName(
  perspective: FacilityPerspective,
  tables: FacilitiesDatasetSqlTables
): string {
  if (perspective === "hyperscale" || perspective === "hyperscale-leased") {
    return tables.hyperscaleFastTable;
  }

  if (perspective === "enterprise") {
    throw new Error(
      `Unsupported facility perspective for table resolution: "${perspective}". Enterprise uses a dedicated table (serve.enterprise_site) and is not backed by the facilities dataset tables.`
    );
  }

  return tables.colocationFastTable;
}

export async function countFacilitiesTableRows(
  perspective: FacilityPerspective,
  tables: FacilitiesDatasetSqlTables
): Promise<number> {
  const tableName = resolveFacilitiesTableName(perspective, tables);

  if (perspective === "hyperscale" || perspective === "hyperscale-leased") {
    const rows = await runQuery<FacilityTableCountRow>(
      `
SELECT
  COUNT(*)::bigint AS total_count
FROM ${tableName};
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
FROM ${tableName};
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
  const tableName = resolveFacilitiesTableName(query.perspective, query.tables);

  if (query.perspective === "hyperscale" || query.perspective === "hyperscale-leased") {
    return runQuery<FacilityTableRow>(
      `
SELECT
  facility.facility_id,
  facility.facility_name,
  facility.provider_id,
  facility.provider_name,
  facility.state_abbrev,
  facility.commissioned_semantic,
  facility.lease_or_own,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  facility.freshness_ts AS updated_at
FROM ${tableName} AS facility
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
  facility.provider_name,
  facility.state_abbrev,
  facility.commissioned_semantic,
  facility.lease_or_own,
  facility.commissioned_power_mw,
  facility.planned_power_mw,
  facility.under_construction_power_mw,
  facility.available_power_mw,
  facility.freshness_ts AS updated_at
FROM ${tableName} AS facility
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, facility_name ASC, facility_id ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}
