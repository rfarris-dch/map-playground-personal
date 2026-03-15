import type { PolygonGeometry } from "@map-migration/geo-kernel/geometry";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import {
  getMarketBoundarySourceVersion,
  listIntersectedCountyIds,
} from "@/geo/analysis-summary/analysis-summary.repo";
import type { CountyScoresStatusRow } from "@/geo/county-intelligence/county-intelligence.repo";
import { getCountyScoresStatusSnapshot } from "@/geo/county-intelligence/county-intelligence.repo";
import {
  queryCountyScores,
  queryCountyScoresStatus,
} from "@/geo/county-intelligence/county-intelligence.service";
import { getFacilitiesPolygonMaxRows } from "@/geo/facilities/facilities.repo";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/facilities-selection-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
import { queryFloodAnalysis } from "@/geo/flood/flood.service";
import { queryMarketsBySelection } from "@/geo/markets/markets-selection.service";
import { mapParcelRowsToFeatures } from "@/geo/parcels/parcels.mapper";
import { enrichParcelsByPolygon } from "@/geo/parcels/parcels.repo";
import {
  coerceCursor,
  paginateEnrichFeatures,
  resolvePageSize,
} from "@/geo/parcels/parcels-pagination.service";
import {
  bboxExceedsLimits,
  PARCELS_MAX_POLYGON_JSON_CHARS,
  resolvePolygonGeometry,
} from "@/geo/parcels/parcels-policy.service";
import { readIngestionRunId } from "@/geo/parcels/parcels-response-meta.service";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";
import type { AnalysisSummaryPorts, ParcelsQueryResult } from "../ports/analysis-summary-ports";

const ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS = parsePositiveIntFlag(
  process.env.ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS,
  20_000
);
const COUNTY_BOUNDARY_RELATION_NAME = "serve.boundary_county_geom_lod1";
const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;
const MARKET_BOUNDARY_RELATION_NAME = "market_current.market_boundaries";

function buildWarning(code: string, message: string): Warning {
  return { code, message };
}

function normalizeCountyFips(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return COUNTY_FIPS_PATTERN.test(normalized) ? normalized : null;
}

function isMissingRelationError(error: unknown, relationName: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(relationName) &&
    error.message.toLowerCase().includes("does not exist")
  );
}

function buildParcelsTotalCapWarning(): Warning {
  return buildWarning(
    "PARCELS_TOTAL_CAP_REACHED",
    `Parcel analysis summary is capped at ${String(ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS)} parcels; use the parcels API for full pagination.`
  );
}

async function queryParcelPage(args: {
  readonly cursor: string | null;
  readonly geometryText: string;
  readonly includeGeometry: "centroid" | "full" | "none" | "simplified";
  readonly queryPageSize: number;
}): Promise<
  | {
      readonly ok: true;
      readonly value: ParcelsFeatureCollection["features"];
    }
  | Extract<ParcelsQueryResult, { ok: false }>
> {
  let rows: Awaited<ReturnType<typeof enrichParcelsByPolygon>>;
  try {
    rows = await enrichParcelsByPolygon(args.geometryText, {
      cursor: args.cursor,
      includeGeometry: args.includeGeometry,
      limit: args.queryPageSize + 1,
    });
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "parcels_query_failed",
      },
    };
  }

  try {
    return {
      ok: true,
      value: mapParcelRowsToFeatures(rows),
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "parcels_mapping_failed",
      },
    };
  }
}

function validateParcelIngestionRun(args: {
  readonly expectedIngestionRunId: string | null;
  readonly features: ParcelsFeatureCollection["features"];
}):
  | {
      readonly actualIngestionRunId: string | null;
      readonly failure: null;
    }
  | {
      readonly actualIngestionRunId: string | null;
      readonly failure: Extract<ParcelsQueryResult, { ok: false }>;
    } {
  const actualIngestionRunId = readIngestionRunId(args.features) ?? null;
  if (
    args.expectedIngestionRunId !== null &&
    args.features.length > 0 &&
    actualIngestionRunId !== args.expectedIngestionRunId
  ) {
    return {
      actualIngestionRunId,
      failure: {
        ok: false,
        value: {
          error: new Error("parcel ingestion run mismatch"),
          reason: "parcel_ingestion_run_mismatch",
        },
      },
    };
  }

  return {
    actualIngestionRunId,
    failure: null,
  };
}

function _resolveParcelPagination(args: {
  readonly nextCursor: string | null;
  readonly paginatedHasMore: boolean;
  readonly parcelCount: number;
  readonly seenCursors: ReadonlySet<string>;
  readonly warnings: Warning[];
}):
  | {
      readonly done: true;
      readonly nextCursor: string | null;
      readonly truncated: boolean;
    }
  | {
      readonly cursor: string;
      readonly done: false;
    } {
  if (args.parcelCount >= ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS && args.paginatedHasMore) {
    args.warnings.push(buildParcelsTotalCapWarning());

    return {
      done: true,
      nextCursor: args.nextCursor,
      truncated: true,
    };
  }

  if (!args.paginatedHasMore || args.nextCursor === null) {
    return {
      done: true,
      nextCursor: null,
      truncated: false,
    };
  }

  if (args.seenCursors.has(args.nextCursor)) {
    args.warnings.push(
      buildWarning(
        "POSSIBLY_TRUNCATED",
        "parcel cursor repeated while paginating; returning the collected parcel subset"
      )
    );

    return {
      done: true,
      nextCursor: args.nextCursor,
      truncated: true,
    };
  }

  return {
    cursor: args.nextCursor,
    done: false,
  };
}

async function queryParcelsImpl(args: {
  readonly expectedIngestionRunId: string | null;
  readonly geometryText: string;
  readonly includeGeometry: "centroid" | "full" | "none" | "simplified";
  readonly pageSize: number | undefined;
}): Promise<ParcelsQueryResult> {
  const pageSizeResolution = resolvePageSize(args.pageSize ?? 20_000);
  const warnings = [...pageSizeResolution.warnings];
  const queryPageSize = Math.min(pageSizeResolution.pageSize, ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS);

  const pageResult = await queryParcelPage({
    cursor: coerceCursor(null),
    geometryText: args.geometryText,
    includeGeometry: args.includeGeometry,
    queryPageSize,
  });
  if (!pageResult.ok) {
    return pageResult;
  }

  const pageWarnings = [...warnings];
  const paginated = paginateEnrichFeatures(pageResult.value, queryPageSize, pageWarnings);
  warnings.splice(0, warnings.length, ...pageWarnings);

  const ingestionRunValidation = validateParcelIngestionRun({
    expectedIngestionRunId: args.expectedIngestionRunId,
    features: paginated.features,
  });
  if (ingestionRunValidation.failure !== null) {
    return ingestionRunValidation.failure;
  }

  const truncated = paginated.hasMore;
  if (truncated) {
    warnings.push(buildParcelsTotalCapWarning());
  }

  return {
    ok: true,
    value: {
      dataVersion: getApiRuntimeConfig().dataVersion,
      features: paginated.features,
      ingestionRunId: ingestionRunValidation.actualIngestionRunId,
      nextCursor: paginated.nextCursor,
      sourceMode: getApiRuntimeConfig().parcelsSourceMode,
      truncated,
      warnings,
    },
  };
}

function resolveParcelPolicyWarningImpl(args: {
  readonly includeParcels: boolean;
  readonly geometry: { type: "polygon"; geometry: PolygonGeometry };
}): Warning | null {
  if (!args.includeParcels) {
    return null;
  }

  if (args.geometry.type !== "polygon") {
    return buildWarning(
      "PARCELS_POLICY_REJECTED",
      "Parcel analysis skipped because only polygon AOIs are supported."
    );
  }

  const polygonAoi: Extract<ParcelEnrichRequest["aoi"], { type: "polygon" }> = {
    type: "polygon",
    geometry: args.geometry.geometry,
  };
  const polygonGeometry = resolvePolygonGeometry(polygonAoi);
  if (bboxExceedsLimits(polygonGeometry.bbox)) {
    return buildWarning(
      "PARCELS_POLICY_REJECTED",
      "Parcel analysis skipped because the selection exceeds the parcel AOI limit."
    );
  }

  if (polygonGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
    return buildWarning(
      "PARCELS_POLICY_REJECTED",
      "Parcel analysis skipped because the selection payload is too large."
    );
  }

  return null;
}

export function createAnalysisSummaryPorts(): AnalysisSummaryPorts {
  let statusRowPromise: Promise<CountyScoresStatusRow> | null = null;
  function getSharedStatusRow(): Promise<CountyScoresStatusRow> {
    if (statusRowPromise === null) {
      statusRowPromise = getCountyScoresStatusSnapshot();
    }
    return statusRowPromise;
  }

  return {
    isDatasetQueryAllowed(args) {
      return isDatasetQueryAllowed(args.dataset, args.queryGranularity);
    },

    resolveFacilitiesGeometry(geometry) {
      return resolveFacilitiesSelectionGeometry(geometry);
    },

    facilitiesBboxExceedsLimits(bbox) {
      return facilitiesSelectionBboxExceedsLimits(bbox);
    },

    facilitiesMaxPolygonJsonChars: FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,

    async normalizeSelectionGeometry(geometryText) {
      const normalizedGeometry = await normalizePolygonGeometryGeoJson(geometryText);

      return {
        geometryText: normalizedGeometry.geometryText,
        warning: normalizedGeometry.wasRepaired
          ? buildPolygonRepairWarning("analysis selection", normalizedGeometry.invalidReason)
          : null,
      };
    },

    resolveFacilitiesLimit(args) {
      const maxRows = getFacilitiesPolygonMaxRows(args.perspective);
      const limit = Math.min(args.requestedLimit, maxRows);
      if (limit === args.requestedLimit) {
        return { limit, warning: null };
      }

      return {
        limit,
        warning: buildWarning(
          `${args.perspective.toUpperCase()}_LIMIT_CLAMPED`,
          `${args.perspective} facilities limit reduced to ${String(maxRows)} due to server policy.`
        ),
      };
    },

    queryFacilitiesByPolygon(args) {
      return queryFacilitiesByPolygon(args);
    },

    resolveParcelPolicyWarning(args) {
      return resolveParcelPolicyWarningImpl(args);
    },

    queryParcels(args) {
      return queryParcelsImpl(args);
    },

    queryFloodAnalysis(args) {
      return queryFloodAnalysis(args);
    },

    async queryCountyScores(args) {
      let statusRow: CountyScoresStatusRow | undefined;
      try {
        statusRow = await getSharedStatusRow();
      } catch (_error) {
        /* ignored */
      }
      return queryCountyScores({
        countyIds: args.countyIds,
        statusSnapshot: statusRow,
      });
    },

    async queryCountyScoresStatus() {
      let statusRow: CountyScoresStatusRow | undefined;
      try {
        statusRow = await getSharedStatusRow();
      } catch (_error) {
        /* ignored */
      }
      return queryCountyScoresStatus({ statusSnapshot: statusRow });
    },

    async lookupSelectionAreaAndCountyIds(geometryGeoJson) {
      try {
        const rows = await listIntersectedCountyIds(geometryGeoJson);

        return {
          ok: true as const,
          value: {
            countyIds: rows
              .map((row) => normalizeCountyFips(row.county_fips))
              .filter((countyId): countyId is string => countyId !== null),
            selectionAreaSqKm: Number(rows[0]?.selection_area_sq_km ?? 0),
          },
        };
      } catch (error) {
        return {
          ok: false as const,
          value: {
            error,
            reason: isMissingRelationError(error, COUNTY_BOUNDARY_RELATION_NAME)
              ? "source_unavailable"
              : "query_failed",
          },
        };
      }
    },

    queryMarketsBySelection(args) {
      return queryMarketsBySelection(args);
    },

    async lookupMarketBoundarySourceVersion() {
      try {
        return {
          ok: true as const,
          value: await getMarketBoundarySourceVersion(),
        };
      } catch (error) {
        return {
          ok: false as const,
          value: {
            error,
            reason: isMissingRelationError(error, MARKET_BOUNDARY_RELATION_NAME)
              ? "source_unavailable"
              : "query_failed",
          },
        };
      }
    },

    getRuntimeMetadata() {
      const runtimeConfig = getApiRuntimeConfig();

      return {
        countyIntelligenceSourceMode: runtimeConfig.countyIntelligenceSourceMode,
        facilitiesDataVersion: runtimeConfig.dataVersion,
        facilitiesSourceMode: runtimeConfig.facilitiesSourceMode,
        floodSourceMode: "postgis",
        marketsDataVersion: runtimeConfig.dataVersion,
        marketsSourceMode: runtimeConfig.marketsSourceMode,
      };
    },
  };
}
