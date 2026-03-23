import type { FacilitiesDatasetSqlTables } from "@map-migration/geo-sql";
import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import { runQuery } from "@/db/postgres";
import {
  type FacilitiesDatasetManifestState,
  getFacilitiesDatasetManifestState,
} from "@/geo/facilities/route/facilities-manifest.service";
import { routeError } from "@/http/effect-route";

declare global {
  var __MAP_API_FACILITIES_DATASET_TABLE_CHECKS__: Map<string, Promise<void>> | undefined;
}

export interface BoundFacilitiesDatasetVersion {
  readonly actualDatasetVersion: string;
  readonly requestedDatasetVersion: string | null;
  readonly tables: FacilitiesDatasetSqlTables;
}

function normalizeDatasetVersion(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readRequestedFacilitiesDatasetVersion(args: {
  readonly headerValue?: string | null | undefined;
  readonly queryValue?: string | null | undefined;
}): string | null {
  return normalizeDatasetVersion(args.queryValue) ?? normalizeDatasetVersion(args.headerValue);
}

interface FacilitiesDatasetRelationLookupRow {
  readonly colocation_exists: boolean;
  readonly hyperscale_exists: boolean;
}

function quoteSqlIdentifierPart(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function buildQualifiedRelationName(schema: string, relation: string): string {
  return `${quoteSqlIdentifierPart(schema)}.${quoteSqlIdentifierPart(relation)}`;
}

function buildFacilitiesDatasetTables(datasetVersion: string): {
  readonly colocationRelationName: string;
  readonly hyperscaleRelationName: string;
  readonly tables: FacilitiesDatasetSqlTables;
} {
  const colocationTableName = `facility_site_fast__${datasetVersion}`;
  const hyperscaleTableName = `hyperscale_site_fast__${datasetVersion}`;

  return {
    colocationRelationName: buildQualifiedRelationName("serve", colocationTableName),
    hyperscaleRelationName: buildQualifiedRelationName("serve", hyperscaleTableName),
    tables: {
      colocationFastTable: buildQualifiedRelationName("serve", colocationTableName),
      hyperscaleFastTable: buildQualifiedRelationName("serve", hyperscaleTableName),
    },
  };
}

function readAllowedDatasetVersions(state: FacilitiesDatasetManifestState): readonly string[] {
  return state.previousVersion === null
    ? [state.currentVersion]
    : [state.currentVersion, state.previousVersion];
}

function getFacilitiesDatasetTableCheckCache(): Map<string, Promise<void>> {
  const cache = globalThis.__MAP_API_FACILITIES_DATASET_TABLE_CHECKS__;
  if (cache instanceof Map) {
    return cache;
  }

  const nextCache = new Map<string, Promise<void>>();
  globalThis.__MAP_API_FACILITIES_DATASET_TABLE_CHECKS__ = nextCache;
  return nextCache;
}

function ensureFacilitiesDatasetTablesExist(args: {
  readonly datasetVersion: string;
  readonly colocationRelationName: string;
  readonly hyperscaleRelationName: string;
  readonly signal?: AbortSignal;
}): Promise<void> {
  const cacheKey = args.datasetVersion;
  const cache = getFacilitiesDatasetTableCheckCache();
  const existingCheck = cache.get(cacheKey);
  if (existingCheck instanceof Promise) {
    return existingCheck;
  }

  const nextCheck = runQuery<FacilitiesDatasetRelationLookupRow>(
    `
SELECT
  to_regclass($1) IS NOT NULL AS colocation_exists,
  to_regclass($2) IS NOT NULL AS hyperscale_exists;
`,
    [args.colocationRelationName, args.hyperscaleRelationName],
    {
      queryClass: "facilities-interactive",
      ...(typeof args.signal === "undefined" ? {} : { signal: args.signal }),
    }
  )
    .then((rows) => {
      const lookup = rows[0];
      if (typeof lookup === "undefined" || !lookup.colocation_exists || !lookup.hyperscale_exists) {
        throw routeError({
          httpStatus: 503,
          code: "FACILITIES_DATASET_TABLES_UNAVAILABLE",
          message: `facilities dataset version "${args.datasetVersion}" is not published`,
          details: {
            colocationRelationName: args.colocationRelationName,
            datasetVersion: args.datasetVersion,
            hyperscaleRelationName: args.hyperscaleRelationName,
          },
        });
      }
    })
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  cache.set(cacheKey, nextCheck);
  return nextCheck;
}

export async function bindFacilitiesDatasetVersion(
  requestedDatasetVersion: string | null,
  signal?: AbortSignal
): Promise<BoundFacilitiesDatasetVersion> {
  const manifestState = await getFacilitiesDatasetManifestState(signal);
  const actualDatasetVersion = requestedDatasetVersion ?? manifestState.currentVersion;
  const allowedDatasetVersions = readAllowedDatasetVersions(manifestState);

  if (!allowedDatasetVersions.includes(actualDatasetVersion)) {
    throw routeError({
      httpStatus: 409,
      code: "FACILITIES_DATASET_VERSION_UNAVAILABLE",
      message: `requested facilities dataset version "${actualDatasetVersion}" is not currently queryable`,
      details: {
        availableDatasetVersions: allowedDatasetVersions,
        datasetVersionHeader: ApiHeaders.datasetVersion,
        requestedDatasetVersion,
      },
    });
  }

  const tables = buildFacilitiesDatasetTables(actualDatasetVersion);
  await ensureFacilitiesDatasetTablesExist({
    datasetVersion: actualDatasetVersion,
    colocationRelationName: tables.colocationRelationName,
    hyperscaleRelationName: tables.hyperscaleRelationName,
    ...(typeof signal === "undefined" ? {} : { signal }),
  });

  return {
    actualDatasetVersion,
    requestedDatasetVersion,
    tables: tables.tables,
  };
}
