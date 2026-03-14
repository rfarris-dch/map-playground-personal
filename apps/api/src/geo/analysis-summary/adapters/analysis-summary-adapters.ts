import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import { parsePositiveIntFlag } from "@/config/env-parsing.service";
import {
  queryCountyScores,
  queryCountyScoresStatus,
} from "@/geo/county-intelligence/county-intelligence.service";
import { getFacilitiesPolygonMaxRows } from "@/geo/facilities/facilities.repo";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  facilitiesSelectionBboxExceedsLimits,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/route/facilities-route-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
import { queryFloodAnalysis } from "@/geo/flood/flood.service";
import { queryMarketsBySelection } from "@/geo/markets/markets-selection.service";
import { mapParcelRowsToFeatures } from "@/geo/parcels/parcels.mapper";
import { enrichParcelsByPolygon } from "@/geo/parcels/parcels.repo";
import {
  coerceCursor,
  paginateEnrichFeatures,
  resolvePageSize,
} from "@/geo/parcels/route/parcels-route-enrich.service";
import {
  profileMetadataWarnings,
  readIngestionRunId,
} from "@/geo/parcels/route/parcels-route-meta.service";
import {
  bboxExceedsLimits,
  PARCELS_MAX_POLYGON_JSON_CHARS,
  resolvePolygonGeometry,
} from "@/geo/parcels/route/parcels-route-policy.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import type { AnalysisSummaryPorts, ParcelsQueryResult } from "../ports/analysis-summary-ports";

const ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS = parsePositiveIntFlag(
  process.env.ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS,
  20_000
);

function buildWarning(code: string, message: string): Warning {
  return { code, message };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parcel pagination preserves existing enrichment, truncation, and ingestion-run safeguards in one helper.
async function queryParcelsImpl(args: {
  readonly expectedIngestionRunId: string | null;
  readonly geometryText: string;
  readonly includeGeometry: "centroid" | "full" | "none" | "simplified";
  readonly pageSize: number | undefined;
}): Promise<ParcelsQueryResult> {
  const pageSizeResolution = resolvePageSize(args.pageSize ?? 20_000);
  const warnings = [...pageSizeResolution.warnings, ...profileMetadataWarnings("analysis_v1")];
  const pageSize = pageSizeResolution.pageSize;
  const parcelsById = new Map<string, ParcelsFeatureCollection["features"][number]>();
  const seenCursors = new Set<string>();
  let cursor = coerceCursor(null);
  let truncated = false;
  let nextCursor: string | null = null;
  let dataVersion = "";
  let sourceMode = getApiRuntimeConfig().parcelsSourceMode;
  let ingestionRunId: string | null = null;

  while (true) {
    const remainingCapacity = ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS - parcelsById.size;
    if (remainingCapacity <= 0) {
      truncated = true;
      warnings.push(
        buildWarning(
          "PARCELS_TOTAL_CAP_REACHED",
          `Parcel analysis summary is capped at ${String(ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS)} parcels; use the parcels API for full pagination.`
        )
      );
      break;
    }

    const queryPageSize = Math.min(pageSize, remainingCapacity);
    let rows: Awaited<ReturnType<typeof enrichParcelsByPolygon>>;
    try {
      rows = await enrichParcelsByPolygon(args.geometryText, {
        cursor,
        includeGeometry: args.includeGeometry,
        limit: queryPageSize + 1,
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

    let mappedFeatures: ParcelsFeatureCollection["features"];
    try {
      mappedFeatures = mapParcelRowsToFeatures(rows);
    } catch (error) {
      return {
        ok: false,
        value: {
          error,
          reason: "parcels_mapping_failed",
        },
      };
    }

    const pageWarnings = [...warnings];
    const paginated = paginateEnrichFeatures(mappedFeatures, queryPageSize, pageWarnings);
    warnings.splice(0, warnings.length, ...pageWarnings);
    const actualIngestionRunId = readIngestionRunId(paginated.features) ?? null;
    if (
      args.expectedIngestionRunId !== null &&
      paginated.features.length > 0 &&
      actualIngestionRunId !== args.expectedIngestionRunId
    ) {
      return {
        ok: false,
        value: {
          error: new Error("parcel ingestion run mismatch"),
          reason: "parcel_ingestion_run_mismatch",
        },
      };
    }

    if (ingestionRunId === null) {
      ingestionRunId = actualIngestionRunId;
    }

    dataVersion = getApiRuntimeConfig().dataVersion;
    sourceMode = getApiRuntimeConfig().parcelsSourceMode;

    for (const feature of paginated.features) {
      parcelsById.set(feature.properties.parcelId, feature);
    }

    if (parcelsById.size >= ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS && paginated.hasMore) {
      truncated = true;
      nextCursor = paginated.nextCursor;
      warnings.push(
        buildWarning(
          "PARCELS_TOTAL_CAP_REACHED",
          `Parcel analysis summary is capped at ${String(ANALYSIS_SUMMARY_MAX_TOTAL_PARCELS)} parcels; use the parcels API for full pagination.`
        )
      );
      break;
    }

    if (!paginated.hasMore || paginated.nextCursor === null) {
      truncated = false;
      nextCursor = null;
      break;
    }

    if (seenCursors.has(paginated.nextCursor)) {
      truncated = true;
      nextCursor = paginated.nextCursor;
      warnings.push(
        buildWarning(
          "POSSIBLY_TRUNCATED",
          "parcel cursor repeated while paginating; returning the collected parcel subset"
        )
      );
      break;
    }

    seenCursors.add(paginated.nextCursor);
    cursor = paginated.nextCursor;
  }

  return {
    ok: true,
    value: {
      dataVersion,
      features: [...parcelsById.values()],
      ingestionRunId,
      nextCursor,
      sourceMode,
      truncated,
      warnings,
    },
  };
}

function resolveParcelPolicyWarningImpl(args: {
  readonly includeParcels: boolean;
  readonly geometry: { type: "polygon"; geometry: unknown };
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

  const polygonGeometry = resolvePolygonGeometry(
    args.geometry as Extract<ParcelEnrichRequest["aoi"], { type: "polygon" }>
  );
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
  return {
    resolveFacilitiesGeometry(geometry) {
      return resolveFacilitiesSelectionGeometry(geometry);
    },

    facilitiesBboxExceedsLimits(bbox) {
      return facilitiesSelectionBboxExceedsLimits(bbox);
    },

    facilitiesMaxPolygonJsonChars: FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,

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

    queryCountyScores(args) {
      return queryCountyScores(args);
    },

    queryCountyScoresStatus() {
      return queryCountyScoresStatus();
    },

    queryMarketsBySelection(args) {
      return queryMarketsBySelection(args);
    },
  };
}
