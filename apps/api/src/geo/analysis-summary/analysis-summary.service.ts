import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
  FacilitiesFeatureCollection,
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
  SpatialAnalysisParcelRecord,
  SpatialAnalysisPerspectiveSummary,
  SpatialAnalysisProviderSummary,
  SpatialAnalysisSelectionSummary,
  SpatialAnalysisSummaryFacilityRecord,
  SpatialAnalysisSummaryResponse,
  Warning,
} from "@map-migration/contracts";
import {
  queryCountyScores,
  queryCountyScoresStatus,
} from "@/geo/county-scores/county-scores.service";
import {
  FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS,
  resolveFacilitiesSelectionGeometry,
} from "@/geo/facilities/route/facilities-route-policy.service";
import { queryFacilitiesByPolygon } from "@/geo/facilities/route/facilities-route-query.service";
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
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";
import { getMarketBoundarySourceVersion, listIntersectedCountyIds } from "./analysis-summary.repo";
import type {
  QuerySpatialAnalysisSummaryArgs,
  QuerySpatialAnalysisSummaryResult,
} from "./analysis-summary.service.types";

const MARKET_BOUNDARY_RELATION_NAME = "market_current.market_boundaries";
const COUNTY_BOUNDARY_RELATION_NAME = "serve.boundary_county_geom_lod1";
const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;

interface AnalysisSummaryDependencies {
  readonly queryCountyScores: typeof queryCountyScores;
  readonly queryCountyScoresStatus: typeof queryCountyScoresStatus;
}

const DEFAULT_ANALYSIS_SUMMARY_DEPENDENCIES: AnalysisSummaryDependencies = {
  queryCountyScores,
  queryCountyScoresStatus,
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readPointCoordinates(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const longitude = value[0];
  const latitude = value[1];
  if (!(isFiniteCoordinate(longitude) && isFiniteCoordinate(latitude))) {
    return null;
  }

  return [longitude, latitude];
}

function resolveDisplayName(name: string, fallback: string): string {
  const normalizedName = name.trim();
  if (normalizedName.length > 0) {
    return normalizedName;
  }

  const normalizedFallback = fallback.trim();
  if (normalizedFallback.length > 0) {
    return normalizedFallback;
  }

  return "-";
}

function normalizeCountyFips(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return COUNTY_FIPS_PATTERN.test(normalized) ? normalized : null;
}

function toSelectionFacility(
  feature: FacilitiesFeatureCollection["features"][number]
): SpatialAnalysisSummaryFacilityRecord | null {
  const coordinates = readPointCoordinates(feature.geometry.coordinates);
  if (coordinates === null) {
    return null;
  }

  return {
    address: feature.properties.address,
    availablePowerMw: feature.properties.availablePowerMw,
    city: feature.properties.city,
    commissionedPowerMw: feature.properties.commissionedPowerMw,
    commissionedSemantic: feature.properties.commissionedSemantic,
    coordinates,
    countyFips: normalizeCountyFips(feature.properties.countyFips),
    facilityId: feature.properties.facilityId,
    facilityName: resolveDisplayName(feature.properties.facilityName, "Unknown facility"),
    leaseOrOwn: feature.properties.leaseOrOwn,
    perspective: feature.properties.perspective,
    plannedPowerMw: feature.properties.plannedPowerMw,
    providerId: feature.properties.providerId,
    providerName: resolveDisplayName(feature.properties.providerName, "Unknown provider"),
    squareFootage: feature.properties.squareFootage,
    state: feature.properties.state,
    stateAbbrev: feature.properties.stateAbbrev,
    statusLabel: feature.properties.statusLabel,
    underConstructionPowerMw: feature.properties.underConstructionPowerMw,
  };
}

function toSelectionParcel(
  feature: ParcelsFeatureCollection["features"][number]
): SpatialAnalysisParcelRecord {
  let coordinates: [number, number] | null = null;
  if (feature.geometry?.type === "Point") {
    coordinates = readPointCoordinates(feature.geometry.coordinates);
  }

  return {
    attrs: feature.properties.attrs,
    coordinates,
    geoid: feature.properties.geoid,
    parcelId: feature.properties.parcelId,
    state2: feature.properties.state2,
  };
}

function initialPerspectiveSummary(): SpatialAnalysisPerspectiveSummary {
  return {
    availablePowerMw: 0,
    commissionedPowerMw: 0,
    count: 0,
    leasedCount: 0,
    operationalCount: 0,
    pipelinePowerMw: 0,
    plannedCount: 0,
    plannedPowerMw: 0,
    squareFootage: 0,
    underConstructionCount: 0,
    underConstructionPowerMw: 0,
    unknownCount: 0,
  };
}

function buildPerspectiveSummary(
  facilities: readonly SpatialAnalysisSummaryFacilityRecord[]
): SpatialAnalysisPerspectiveSummary {
  return facilities.reduce<SpatialAnalysisPerspectiveSummary>((summary, facility) => {
    const availablePowerMw =
      typeof facility.availablePowerMw === "number" ? facility.availablePowerMw : 0;
    const commissionedPowerMw =
      typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0;
    const plannedPowerMw =
      typeof facility.plannedPowerMw === "number" ? facility.plannedPowerMw : 0;
    const squareFootage = typeof facility.squareFootage === "number" ? facility.squareFootage : 0;
    const underConstructionPowerMw =
      typeof facility.underConstructionPowerMw === "number" ? facility.underConstructionPowerMw : 0;

    const nextSummary: SpatialAnalysisPerspectiveSummary = {
      availablePowerMw: summary.availablePowerMw + availablePowerMw,
      commissionedPowerMw: summary.commissionedPowerMw + commissionedPowerMw,
      count: summary.count + 1,
      leasedCount: summary.leasedCount,
      operationalCount: summary.operationalCount,
      pipelinePowerMw: summary.pipelinePowerMw + plannedPowerMw + underConstructionPowerMw,
      plannedCount: summary.plannedCount,
      plannedPowerMw: summary.plannedPowerMw + plannedPowerMw,
      squareFootage: summary.squareFootage + squareFootage,
      underConstructionCount: summary.underConstructionCount,
      underConstructionPowerMw: summary.underConstructionPowerMw + underConstructionPowerMw,
      unknownCount: summary.unknownCount,
    };

    if (facility.commissionedSemantic === "leased") {
      return {
        ...nextSummary,
        leasedCount: summary.leasedCount + 1,
      };
    }

    if (facility.commissionedSemantic === "operational") {
      return {
        ...nextSummary,
        operationalCount: summary.operationalCount + 1,
      };
    }

    if (facility.commissionedSemantic === "planned") {
      return {
        ...nextSummary,
        plannedCount: summary.plannedCount + 1,
      };
    }

    if (facility.commissionedSemantic === "under_construction") {
      return {
        ...nextSummary,
        underConstructionCount: summary.underConstructionCount + 1,
      };
    }

    return {
      ...nextSummary,
      unknownCount: summary.unknownCount + 1,
    };
  }, initialPerspectiveSummary());
}

function buildTopProviders(
  facilities: readonly SpatialAnalysisSummaryFacilityRecord[]
): readonly SpatialAnalysisProviderSummary[] {
  const providers = facilities.reduce<
    Map<string, { commissionedPowerMw: number; count: number; providerName: string }>
  >((lookup, facility) => {
    const current = lookup.get(facility.providerId) ?? {
      commissionedPowerMw: 0,
      count: 0,
      providerName: facility.providerName,
    };

    lookup.set(facility.providerId, {
      commissionedPowerMw:
        current.commissionedPowerMw +
        (typeof facility.commissionedPowerMw === "number" ? facility.commissionedPowerMw : 0),
      count: current.count + 1,
      providerName: current.providerName,
    });

    return lookup;
  }, new Map<string, { commissionedPowerMw: number; count: number; providerName: string }>());

  return [...providers.entries()]
    .map(([providerId, summary]) => ({
      commissionedPowerMw: summary.commissionedPowerMw,
      count: summary.count,
      providerId,
      providerName: summary.providerName,
    }))
    .sort((left, right) => {
      if (right.commissionedPowerMw !== left.commissionedPowerMw) {
        return right.commissionedPowerMw - left.commissionedPowerMw;
      }

      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (left.providerName !== right.providerName) {
        return left.providerName.localeCompare(right.providerName);
      }

      return left.providerId.localeCompare(right.providerId);
    })
    .slice(0, 5);
}

function deriveCountyIdsFromFeatures(args: {
  readonly facilities: readonly SpatialAnalysisSummaryFacilityRecord[];
  readonly parcels: readonly SpatialAnalysisParcelRecord[];
}): readonly string[] {
  const countyIds = new Set<string>();

  for (const facility of args.facilities) {
    const countyFips = normalizeCountyFips(facility.countyFips);
    if (countyFips !== null) {
      countyIds.add(countyFips);
    }
  }

  for (const parcel of args.parcels) {
    const geoid = parcel.geoid;
    if (typeof geoid !== "string") {
      continue;
    }

    const countyFips = normalizeCountyFips(geoid.slice(0, 5));
    if (countyFips !== null) {
      countyIds.add(countyFips);
    }
  }

  return [...countyIds].sort((left, right) => left.localeCompare(right));
}

function buildSelectionSummary(args: {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly countyIds: readonly string[];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly marketSelection: SpatialAnalysisSelectionSummary["marketSelection"];
  readonly parcelFeatures: ParcelsFeatureCollection["features"];
  readonly parcelNextCursor: string | null;
  readonly parcelTruncated: boolean;
}): SpatialAnalysisSelectionSummary {
  const colocationFacilities = args.colocationFeatures
    .map((feature) => toSelectionFacility(feature))
    .filter((facility): facility is SpatialAnalysisSummaryFacilityRecord => facility !== null);
  const hyperscaleFacilities = args.hyperscaleFeatures
    .map((feature) => toSelectionFacility(feature))
    .filter((facility): facility is SpatialAnalysisSummaryFacilityRecord => facility !== null);
  const facilities = [...colocationFacilities, ...hyperscaleFacilities];
  const parcels = args.parcelFeatures.map((feature) => toSelectionParcel(feature));

  return {
    colocation: buildPerspectiveSummary(colocationFacilities),
    countyIds: [...args.countyIds],
    facilities,
    hyperscale: buildPerspectiveSummary(hyperscaleFacilities),
    marketSelection: {
      ...args.marketSelection,
      markets: [...args.marketSelection.markets],
    },
    parcelSelection: {
      count: parcels.length,
      nextCursor: args.parcelNextCursor,
      parcels,
      truncated: args.parcelTruncated,
    },
    topColocationProviders: [...buildTopProviders(colocationFacilities)],
    topHyperscaleProviders: [...buildTopProviders(hyperscaleFacilities)],
    totalCount: facilities.length,
  };
}

function buildWarning(code: string, message: string): Warning {
  return {
    code,
    message,
  };
}

function emptyParcelQueryValue(args: { readonly warnings?: readonly Warning[] }): {
  readonly dataVersion: string | null;
  readonly features: ParcelsFeatureCollection["features"];
  readonly ingestionRunId: string | null;
  readonly nextCursor: string | null;
  readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
} {
  return {
    dataVersion: null,
    features: [],
    ingestionRunId: null,
    nextCursor: null,
    sourceMode: null,
    truncated: false,
    warnings: args.warnings ?? [],
  };
}

function resolveParcelPolicyWarning(args: {
  readonly includeParcels: boolean;
  readonly geometry: ParcelEnrichRequest["aoi"];
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

  const polygonGeometry = resolvePolygonGeometry(args.geometry);
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

function isMissingRelationError(error: unknown, relationName: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(relationName) &&
    error.message.toLowerCase().includes("does not exist")
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parcel pagination preserves existing enrichment, truncation, and ingestion-run safeguards in one helper.
async function queryParcels(args: {
  readonly expectedIngestionRunId: string | null;
  readonly request: ParcelEnrichRequest;
}): Promise<
  | {
      readonly ok: true;
      readonly value: {
        readonly dataVersion: string;
        readonly features: ParcelsFeatureCollection["features"];
        readonly ingestionRunId: string | null;
        readonly nextCursor: string | null;
        readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
        readonly truncated: boolean;
        readonly warnings: readonly Warning[];
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason:
          | "parcel_ingestion_run_mismatch"
          | "parcels_mapping_failed"
          | "parcels_policy_rejected"
          | "parcels_query_failed";
      };
    }
> {
  if (args.request.aoi.type !== "polygon") {
    return {
      ok: false,
      value: {
        error: new Error("analysis summary only supports polygon parcel AOI"),
        reason: "parcels_policy_rejected",
      },
    };
  }

  const polygonGeometry = resolvePolygonGeometry(args.request.aoi);
  if (bboxExceedsLimits(polygonGeometry.bbox)) {
    return {
      ok: false,
      value: {
        error: new Error("polygon AOI exceeds configured bbox limits"),
        reason: "parcels_policy_rejected",
      },
    };
  }

  if (polygonGeometry.geometryText.length > PARCELS_MAX_POLYGON_JSON_CHARS) {
    return {
      ok: false,
      value: {
        error: new Error("polygon AOI payload is too large"),
        reason: "parcels_policy_rejected",
      },
    };
  }

  const pageSizeResolution = resolvePageSize(args.request.pageSize ?? 20_000);
  const warnings = [
    ...pageSizeResolution.warnings,
    ...profileMetadataWarnings(args.request.profile),
  ];
  const pageSize = pageSizeResolution.pageSize;
  const parcelsById = new Map<string, ParcelsFeatureCollection["features"][number]>();
  const seenCursors = new Set<string>();
  let cursor = coerceCursor(args.request.cursor);
  let truncated = false;
  let nextCursor: string | null = null;
  let dataVersion = "";
  let sourceMode = getApiRuntimeConfig().parcelsSourceMode;
  let ingestionRunId: string | null = null;

  while (true) {
    let rows: Awaited<ReturnType<typeof enrichParcelsByPolygon>>;
    try {
      rows = await enrichParcelsByPolygon(polygonGeometry.geometryText, {
        cursor,
        includeGeometry: args.request.includeGeometry,
        limit: pageSize + 1,
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
    const paginated = paginateEnrichFeatures(mappedFeatures, pageSize, pageWarnings);
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestration composes multiple existing slices and degraded-state rules into one canonical response.
export async function querySpatialAnalysisSummary(
  args: QuerySpatialAnalysisSummaryArgs,
  dependencies: AnalysisSummaryDependencies = DEFAULT_ANALYSIS_SUMMARY_DEPENDENCIES
): Promise<QuerySpatialAnalysisSummaryResult> {
  const facilitiesQueryAllowed = isDatasetQueryAllowed("facilities", "polygon");
  if (!facilitiesQueryAllowed) {
    return {
      ok: false,
      value: {
        error: new Error('query granularity "polygon" is not allowed for facilities'),
        reason: "facilities_policy_rejected",
      },
    };
  }

  const parcelsQueryAllowed = isDatasetQueryAllowed("parcels", "polygon");
  if (args.request.includeParcels && !parcelsQueryAllowed) {
    return {
      ok: false,
      value: {
        error: new Error('query granularity "polygon" is not allowed for parcels'),
        reason: "parcels_policy_rejected",
      },
    };
  }

  const facilitiesGeometry = resolveFacilitiesSelectionGeometry(args.request.geometry);
  if (facilitiesGeometry.geometryText.length > FACILITIES_SELECTION_MAX_POLYGON_JSON_CHARS) {
    return {
      ok: false,
      value: {
        error: new Error("selection polygon AOI payload is too large"),
        reason: "facilities_policy_rejected",
      },
    };
  }

  const requestedPerspectives = new Set(args.request.perspectives);
  const shouldQueryColocation = requestedPerspectives.has("colocation");
  const shouldQueryHyperscale = requestedPerspectives.has("hyperscale");
  const parcelPolicyWarning = resolveParcelPolicyWarning({
    geometry: {
      type: "polygon",
      geometry: args.request.geometry,
    },
    includeParcels: args.request.includeParcels,
  });
  const parcelResultPromise = (() => {
    if (!args.request.includeParcels) {
      return Promise.resolve({
        ok: true as const,
        value: emptyParcelQueryValue({}),
      });
    }

    if (parcelPolicyWarning !== null) {
      return Promise.resolve({
        ok: true as const,
        value: emptyParcelQueryValue({
          warnings: [parcelPolicyWarning],
        }),
      });
    }

    return queryParcels({
      expectedIngestionRunId: args.expectedParcelIngestionRunId,
      request: {
        aoi: {
          type: "polygon",
          geometry: args.request.geometry,
        },
        format: "json",
        includeGeometry: "centroid",
        pageSize: args.request.parcelPageSize,
        profile: "analysis_v1",
      },
    });
  })();

  const [
    colocationResult,
    hyperscaleResult,
    marketsResult,
    parcelResult,
    countyStatusResult,
    countyAreaResult,
    marketBoundarySourceVersionResult,
  ] = await Promise.all([
    shouldQueryColocation
      ? queryFacilitiesByPolygon({
          geometryGeoJson: facilitiesGeometry.geometryText,
          limit: args.request.limitPerPerspective,
          perspective: "colocation",
        })
      : Promise.resolve({
          ok: true as const,
          value: {
            features: [],
            truncated: false,
            warnings: [],
          },
        }),
    shouldQueryHyperscale
      ? queryFacilitiesByPolygon({
          geometryGeoJson: facilitiesGeometry.geometryText,
          limit: args.request.limitPerPerspective,
          perspective: "hyperscale",
        })
      : Promise.resolve({
          ok: true as const,
          value: {
            features: [],
            truncated: false,
            warnings: [],
          },
        }),
    queryMarketsBySelection({
      geometryGeoJson: JSON.stringify(args.request.geometry),
      limit: 25,
      minimumSelectionOverlapPercent: args.request.minimumMarketSelectionOverlapPercent,
    }),
    parcelResultPromise,
    dependencies.queryCountyScoresStatus(),
    listIntersectedCountyIds(JSON.stringify(args.request.geometry)).then(
      (rows) => ({
        ok: true as const,
        value: rows,
      }),
      (error: unknown) => ({
        ok: false as const,
        value: error,
      })
    ),
    getMarketBoundarySourceVersion().then(
      (sourceVersion) => ({
        ok: true as const,
        value: sourceVersion,
      }),
      (error: unknown) => ({
        ok: false as const,
        value: error,
      })
    ),
  ]);

  if (!colocationResult.ok) {
    return {
      ok: false,
      value: {
        error: colocationResult.value.error,
        reason:
          colocationResult.value.reason === "mapping_failed"
            ? "facilities_mapping_failed"
            : "facilities_query_failed",
      },
    };
  }

  if (!hyperscaleResult.ok) {
    return {
      ok: false,
      value: {
        error: hyperscaleResult.value.error,
        reason:
          hyperscaleResult.value.reason === "mapping_failed"
            ? "facilities_mapping_failed"
            : "facilities_query_failed",
      },
    };
  }

  if (!parcelResult.ok) {
    return {
      ok: false,
      value: {
        error: parcelResult.value.error,
        reason: parcelResult.value.reason,
      },
    };
  }

  const warnings: Warning[] = [
    ...colocationResult.value.warnings,
    ...hyperscaleResult.value.warnings,
    ...parcelResult.value.warnings,
  ];

  const marketSelection: SpatialAnalysisSelectionSummary["marketSelection"] = marketsResult.ok
    ? {
        markets: [...marketsResult.value.matchedMarkets],
        matchCount: marketsResult.value.matchedMarkets.length,
        minimumSelectionOverlapPercent: args.request.minimumMarketSelectionOverlapPercent,
        primaryMarket: marketsResult.value.primaryMarket,
        selectionAreaSqKm: marketsResult.value.selectionAreaSqKm,
        unavailableReason: null,
      }
    : {
        markets: [],
        matchCount: 0,
        minimumSelectionOverlapPercent: args.request.minimumMarketSelectionOverlapPercent,
        primaryMarket: null,
        selectionAreaSqKm: 0,
        unavailableReason:
          marketsResult.value.reason === "boundary_source_unavailable"
            ? "Market boundary dataset is unavailable."
            : "Market selection query failed.",
      };

  if (!marketsResult.ok) {
    warnings.push(
      buildWarning(
        marketsResult.value.reason === "boundary_source_unavailable"
          ? "MARKET_BOUNDARY_SOURCE_UNAVAILABLE"
          : "MARKET_SELECTION_FAILED",
        marketSelection.unavailableReason ?? "Market selection is unavailable."
      )
    );
  }

  const countyIdsFromGeometry = countyAreaResult.ok
    ? countyAreaResult.value
        .map((row) => normalizeCountyFips(row.county_fips))
        .filter((countyId): countyId is string => countyId !== null)
    : [];
  const selectionAreaSqKm = countyAreaResult.ok
    ? Number(
        countyAreaResult.value[0]?.selection_area_sq_km ?? marketSelection.selectionAreaSqKm ?? 0
      )
    : marketSelection.selectionAreaSqKm;

  const provisionalSummary = buildSelectionSummary({
    colocationFeatures: colocationResult.value.features,
    countyIds: countyIdsFromGeometry,
    hyperscaleFeatures: hyperscaleResult.value.features,
    marketSelection,
    parcelFeatures: parcelResult.value.features,
    parcelNextCursor: parcelResult.value.nextCursor,
    parcelTruncated: parcelResult.value.truncated,
  });

  const countyIds =
    countyIdsFromGeometry.length > 0
      ? countyIdsFromGeometry
      : deriveCountyIdsFromFeatures({
          facilities: provisionalSummary.facilities,
          parcels: provisionalSummary.parcelSelection.parcels,
        });

  if (!countyAreaResult.ok && countyIds.length > 0) {
    warnings.push(
      buildWarning(
        "COUNTY_BOUNDARY_LOOKUP_FAILED",
        "County boundary lookup failed; county ids were derived from facility and parcel results."
      )
    );
  }

  if (
    !countyAreaResult.ok &&
    isMissingRelationError(countyAreaResult.value, COUNTY_BOUNDARY_RELATION_NAME)
  ) {
    warnings.push(
      buildWarning(
        "COUNTY_BOUNDARY_SOURCE_UNAVAILABLE",
        "County boundary dataset is unavailable; county ids were derived from available analysis records."
      )
    );
  }

  const summary =
    provisionalSummary.countyIds.length === countyIds.length
      ? provisionalSummary
      : buildSelectionSummary({
          colocationFeatures: colocationResult.value.features,
          countyIds,
          hyperscaleFeatures: hyperscaleResult.value.features,
          marketSelection,
          parcelFeatures: parcelResult.value.features,
          parcelNextCursor: parcelResult.value.nextCursor,
          parcelTruncated: parcelResult.value.truncated,
        });

  const countyQueryAllowed = isDatasetQueryAllowed("county_scores", "county");
  let countyScores: CountyScoresResponse | null = null;
  let countyStatus: CountyScoresStatusResponse | null = null;
  let countyUnavailableReason: string | null = null;

  if (countyStatusResult.ok) {
    countyStatus = {
      ...countyStatusResult.value,
      meta: {
        dataVersion: countyStatusResult.value.dataVersion ?? "unpublished",
        generatedAt: new Date().toISOString(),
        recordCount: 1,
        requestId: "analysis-summary",
        sourceMode: "postgis",
        truncated: false,
        warnings: [],
      },
    };
  } else {
    countyUnavailableReason = "County intelligence status is unavailable.";
    warnings.push(buildWarning("COUNTY_INTELLIGENCE_STATUS_UNAVAILABLE", countyUnavailableReason));
  }

  if (!countyQueryAllowed) {
    countyUnavailableReason = 'query granularity "county" is not allowed for county_scores';
    warnings.push(buildWarning("COUNTY_INTELLIGENCE_POLICY_REJECTED", countyUnavailableReason));
  } else if (countyIds.length > 0) {
    const countyScoresResult = await dependencies.queryCountyScores({
      countyIds,
    });

    if (countyScoresResult.ok) {
      countyScores = {
        meta: {
          dataVersion: countyScoresResult.value.dataVersion,
          generatedAt: new Date().toISOString(),
          recordCount: countyScoresResult.value.rows.length,
          requestId: "analysis-summary",
          sourceMode: "postgis",
          truncated: false,
          warnings: [],
        },
        rows: [...countyScoresResult.value.rows],
        summary: {
          missingCountyIds: [...countyScoresResult.value.missingCountyIds],
          requestedCountyIds: [...countyScoresResult.value.requestedCountyIds],
          unavailableCountyIds: [...countyScoresResult.value.unavailableCountyIds],
        },
      };
    } else {
      countyUnavailableReason =
        countyScoresResult.value.reason === "source_unavailable"
          ? "County intelligence publication is unavailable."
          : "County intelligence scores are unavailable.";
      warnings.push(
        buildWarning(
          countyScoresResult.value.reason === "source_unavailable"
            ? "COUNTY_INTELLIGENCE_UNAVAILABLE"
            : "COUNTY_INTELLIGENCE_FAILED",
          countyUnavailableReason
        )
      );
    }
  }

  const marketSourceVersion = marketBoundarySourceVersionResult.ok
    ? marketBoundarySourceVersionResult.value
    : null;
  if (
    !marketBoundarySourceVersionResult.ok &&
    isMissingRelationError(marketBoundarySourceVersionResult.value, MARKET_BOUNDARY_RELATION_NAME)
  ) {
    warnings.push(
      buildWarning(
        "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
        "Market boundary provenance is unavailable because the boundary source is missing."
      )
    );
  }

  const runtimeConfig = getApiRuntimeConfig();

  return {
    ok: true,
    value: {
      area: {
        countyIds: [...countyIds],
        selectionAreaSqKm: Number.isFinite(selectionAreaSqKm) ? selectionAreaSqKm : 0,
      },
      countyIntelligence: {
        requestedCountyIds: [...countyIds],
        scores: countyScores,
        status: countyStatus,
        unavailableReason: countyUnavailableReason,
      },
      coverage: {
        countyIntelligence: {
          availableFeatureFamilies: [...(countyStatus?.availableFeatureFamilies ?? [])],
          datasetAvailable: countyStatus?.datasetAvailable ?? false,
          missingFeatureFamilies: [...(countyStatus?.missingFeatureFamilies ?? [])],
        },
        markets: {
          boundarySourceAvailable:
            marketsResult.ok || marketsResult.value.reason !== "boundary_source_unavailable",
          unavailableReason: marketSelection.unavailableReason,
        },
        parcels: {
          included: args.request.includeParcels && parcelPolicyWarning === null,
          nextCursor: parcelResult.value.nextCursor,
          truncated: parcelResult.value.truncated,
        },
      },
      policy: {
        countyIntelligence: {
          dataset: "county_scores",
          queryAllowed: countyQueryAllowed,
          queryGranularity: "county",
        },
        facilities: {
          dataset: "facilities",
          queryAllowed: facilitiesQueryAllowed,
          queryGranularity: "polygon",
        },
        parcels: {
          dataset: "parcels",
          queryAllowed: parcelsQueryAllowed,
          queryGranularity: "polygon",
        },
      },
      provenance: {
        countyIntelligence: {
          dataVersion: countyStatus?.dataVersion ?? null,
          formulaVersion: countyStatus?.formulaVersion ?? null,
          inputDataVersion: countyStatus?.inputDataVersion ?? null,
          methodologyId: countyStatus?.methodologyId ?? null,
          publicationRunId: countyStatus?.publicationRunId ?? null,
          publishedAt: countyStatus?.publishedAt ?? null,
        },
        facilities: {
          countsByPerspective: {
            colocation: colocationResult.value.features.length,
            hyperscale: hyperscaleResult.value.features.length,
          },
          dataVersion: runtimeConfig.dataVersion,
          sourceMode: runtimeConfig.facilitiesSourceMode,
          truncatedByPerspective: {
            colocation: colocationResult.value.truncated,
            hyperscale: hyperscaleResult.value.truncated,
          },
          warnings: [...colocationResult.value.warnings, ...hyperscaleResult.value.warnings],
        },
        markets: {
          dataVersion: runtimeConfig.dataVersion,
          sourceMode: "postgis",
          sourceVersion: marketSourceVersion,
          unavailableReason: marketSelection.unavailableReason,
          warnings: marketsResult.ok
            ? []
            : [
                buildWarning(
                  marketSelection.unavailableReason === "Market boundary dataset is unavailable."
                    ? "MARKET_BOUNDARY_SOURCE_UNAVAILABLE"
                    : "MARKET_SELECTION_FAILED",
                  marketSelection.unavailableReason ?? "Market selection is unavailable."
                ),
              ],
        },
        parcels: {
          dataVersion: parcelResult.value.dataVersion,
          ingestionRunId: parcelResult.value.ingestionRunId,
          nextCursor: parcelResult.value.nextCursor,
          sourceMode: parcelResult.value.sourceMode,
          warnings: [...parcelResult.value.warnings],
        },
      },
      request: args.request,
      summary,
      warnings,
    },
  };
}
