import type { Warning } from "@map-migration/geo-kernel/warning";
import {
  type CountyScoresResponse,
  CountyScoresResponseSchema,
  type CountyScoresStatusResponse,
  CountyScoresStatusResponseSchema,
} from "@map-migration/http-contracts/county-intelligence-http";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import type {
  SpatialAnalysisFloodSummary,
  SpatialAnalysisParcelRecord,
  SpatialAnalysisPerspectiveSummary,
  SpatialAnalysisProviderSummary,
  SpatialAnalysisSelectionSummary,
  SpatialAnalysisSummaryFacilityRecord,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import {
  buildPolygonRepairWarning,
  normalizePolygonGeometryGeoJson,
} from "@/http/polygon-normalization.service";
import { getApiRuntimeConfig } from "@/http/runtime-config";
import { isDatasetQueryAllowed } from "@/http/spatial-analysis-policy.service";
import { getMarketBoundarySourceVersion, listIntersectedCountyIds } from "./analysis-summary.repo";
import type {
  QuerySpatialAnalysisSummaryArgs,
  QuerySpatialAnalysisSummaryResult,
} from "./analysis-summary.service.types";
import type { AnalysisSummaryPorts } from "./ports/analysis-summary-ports";

const MARKET_BOUNDARY_RELATION_NAME = "market_current.market_boundaries";
const COUNTY_BOUNDARY_RELATION_NAME = "serve.boundary_county_geom_lod1";
const COUNTY_FIPS_PATTERN = /^[0-9]{5}$/;

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
  readonly flood: SpatialAnalysisFloodSummary;
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
    flood: args.flood,
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

function emptyFloodSummary(unavailableReason: string | null): SpatialAnalysisFloodSummary {
  return {
    flood100AreaSqKm: 0,
    flood100SelectionShare: 0,
    flood500AreaSqKm: 0,
    flood500SelectionShare: 0,
    parcelCountIntersectingFlood100: 0,
    parcelCountIntersectingFlood500: 0,
    parcelCountOutsideMappedFlood: 0,
    selectionAreaSqKm: 0,
    unavailableReason,
  };
}

function validateCountyScoresPayload(payload: CountyScoresResponse): CountyScoresResponse | null {
  const parsed = CountyScoresResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function validateCountyScoresStatusPayload(
  payload: CountyScoresStatusResponse
): CountyScoresStatusResponse | null {
  const parsed = CountyScoresStatusResponseSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
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

function isMissingRelationError(error: unknown, relationName: string): boolean {
  return (
    error instanceof Error &&
    error.message.includes(relationName) &&
    error.message.toLowerCase().includes("does not exist")
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestration composes multiple existing slices and degraded-state rules into one canonical response.
export async function querySpatialAnalysisSummary(
  args: QuerySpatialAnalysisSummaryArgs,
  ports: AnalysisSummaryPorts
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
  const floodQueryAllowed = isDatasetQueryAllowed("environmental_flood", "polygon");

  const facilitiesGeometry = ports.resolveFacilitiesGeometry(args.request.geometry);
  if (ports.facilitiesBboxExceedsLimits(facilitiesGeometry.bbox)) {
    return {
      ok: false,
      value: {
        error: new Error("selection polygon AOI exceeds the facilities analysis extent limit"),
        reason: "facilities_policy_rejected",
      },
    };
  }

  if (facilitiesGeometry.geometryText.length > ports.facilitiesMaxPolygonJsonChars) {
    return {
      ok: false,
      value: {
        error: new Error("selection polygon AOI payload is too large"),
        reason: "facilities_policy_rejected",
      },
    };
  }

  let normalizedGeometryText = facilitiesGeometry.geometryText;
  const geometryWarnings: Warning[] = [];
  try {
    const normalizedGeometry = await normalizePolygonGeometryGeoJson(
      facilitiesGeometry.geometryText
    );
    normalizedGeometryText = normalizedGeometry.geometryText;
    if (normalizedGeometry.wasRepaired) {
      geometryWarnings.push(
        buildPolygonRepairWarning("analysis selection", normalizedGeometry.invalidReason)
      );
    }
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "facilities_policy_rejected",
      },
    };
  }

  const requestedPerspectives = new Set(args.request.perspectives);
  const shouldQueryColocation = requestedPerspectives.has("colocation");
  const shouldQueryHyperscale = requestedPerspectives.has("hyperscale");
  const colocationFacilitiesLimit = ports.resolveFacilitiesLimit({
    perspective: "colocation",
    requestedLimit: args.request.limitPerPerspective,
  });
  const hyperscaleFacilitiesLimit = ports.resolveFacilitiesLimit({
    perspective: "hyperscale",
    requestedLimit: args.request.limitPerPerspective,
  });
  const parcelPolicyWarning = ports.resolveParcelPolicyWarning({
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

    return ports.queryParcels({
      expectedIngestionRunId: args.expectedParcelIngestionRunId,
      geometryText: normalizedGeometryText,
      includeGeometry: "centroid",
      pageSize: args.request.parcelPageSize,
    });
  })();
  const floodResultPromise = (() => {
    if (!args.request.includeFlood) {
      return Promise.resolve({
        dataVersion: null,
        datasetAvailable: false,
        runId: null,
        sourceMode: null as SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null,
        summary: emptyFloodSummary(null),
        warnings: [] as readonly Warning[],
      });
    }

    if (!floodQueryAllowed) {
      const unavailableReason =
        'query granularity "polygon" is not allowed for environmental_flood';
      return Promise.resolve({
        dataVersion: null,
        datasetAvailable: false,
        runId: null,
        sourceMode: null as SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null,
        summary: emptyFloodSummary(unavailableReason),
        warnings: [buildWarning("FLOOD_POLICY_REJECTED", unavailableReason)],
      });
    }

    return ports
      .queryFloodAnalysis({
        geometryGeoJson: normalizedGeometryText,
      })
      .then((result) => {
        if (result.ok) {
          return {
            dataVersion: result.value.dataVersion,
            datasetAvailable: true,
            runId: result.value.runId,
            sourceMode: "postgis" as const,
            summary: result.value.summary,
            warnings: [] as readonly Warning[],
          };
        }

        const unavailableReason =
          result.value.reason === "source_unavailable"
            ? "Environmental flood dataset is unavailable."
            : "Environmental flood analysis is unavailable.";
        return {
          dataVersion: null,
          datasetAvailable: false,
          runId: null,
          sourceMode: null as SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null,
          summary: emptyFloodSummary(unavailableReason),
          warnings: [
            buildWarning(
              result.value.reason === "source_unavailable"
                ? "FLOOD_SOURCE_UNAVAILABLE"
                : "FLOOD_ANALYSIS_FAILED",
              unavailableReason
            ),
          ],
        };
      });
  })();

  const [
    colocationResult,
    floodResult,
    hyperscaleResult,
    marketsResult,
    parcelResult,
    countyStatusResult,
    countyAreaResult,
    marketBoundarySourceVersionResult,
  ] = await Promise.all([
    shouldQueryColocation
      ? ports.queryFacilitiesByPolygon({
          geometryGeoJson: normalizedGeometryText,
          limit: colocationFacilitiesLimit.limit,
          perspective: "colocation",
        })
      : Promise.resolve({
          ok: true as const,
          value: {
            features: [] as FacilitiesFeatureCollection["features"],
            truncated: false,
            warnings: [] as Warning[],
          },
        }),
    floodResultPromise,
    shouldQueryHyperscale
      ? ports.queryFacilitiesByPolygon({
          geometryGeoJson: normalizedGeometryText,
          limit: hyperscaleFacilitiesLimit.limit,
          perspective: "hyperscale",
        })
      : Promise.resolve({
          ok: true as const,
          value: {
            features: [] as FacilitiesFeatureCollection["features"],
            truncated: false,
            warnings: [] as Warning[],
          },
        }),
    ports.queryMarketsBySelection({
      geometryGeoJson: normalizedGeometryText,
      limit: 25,
      minimumSelectionOverlapPercent: args.request.minimumMarketSelectionOverlapPercent,
    }),
    parcelResultPromise,
    ports.queryCountyScoresStatus(),
    listIntersectedCountyIds(normalizedGeometryText).then(
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
    ...geometryWarnings,
    ...(colocationFacilitiesLimit.warning === null ? [] : [colocationFacilitiesLimit.warning]),
    ...colocationResult.value.warnings,
    ...floodResult.warnings,
    ...(hyperscaleFacilitiesLimit.warning === null ? [] : [hyperscaleFacilitiesLimit.warning]),
    ...hyperscaleResult.value.warnings,
    ...(marketsResult.ok ? marketsResult.value.warnings : []),
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
    flood: floodResult.summary,
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
          flood: floodResult.summary,
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
    const countyStatusPayload: CountyScoresStatusResponse = {
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
    countyStatus = validateCountyScoresStatusPayload(countyStatusPayload);
    if (countyStatus === null) {
      countyUnavailableReason = "County intelligence status is temporarily unavailable.";
      warnings.push(buildWarning("COUNTY_INTELLIGENCE_STATUS_INVALID", countyUnavailableReason));
    }
  } else {
    countyUnavailableReason = "County intelligence status is unavailable.";
    warnings.push(buildWarning("COUNTY_INTELLIGENCE_STATUS_UNAVAILABLE", countyUnavailableReason));
  }

  if (!countyQueryAllowed) {
    countyUnavailableReason = 'query granularity "county" is not allowed for county_scores';
    warnings.push(buildWarning("COUNTY_INTELLIGENCE_POLICY_REJECTED", countyUnavailableReason));
  } else if (countyIds.length > 0) {
    const countyScoresResult = await ports.queryCountyScores({
      countyIds,
    });

    if (countyScoresResult.ok) {
      const countyScoresPayload: CountyScoresResponse = {
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
          blockedCountyIds: [...countyScoresResult.value.blockedCountyIds],
          deferredCountyIds: [...countyScoresResult.value.deferredCountyIds],
          missingCountyIds: [...countyScoresResult.value.missingCountyIds],
          requestedCountyIds: [...countyScoresResult.value.requestedCountyIds],
        },
      };
      countyScores = validateCountyScoresPayload(countyScoresPayload);
      if (countyScores === null) {
        countyUnavailableReason = "County intelligence scores are temporarily unavailable.";
        warnings.push(buildWarning("COUNTY_INTELLIGENCE_INVALID", countyUnavailableReason));
      }
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
        flood: {
          datasetAvailable: floodResult.datasetAvailable,
          included: args.request.includeFlood && floodQueryAllowed,
          unavailableReason: floodResult.summary.unavailableReason,
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
        flood: {
          dataset: "environmental_flood",
          queryAllowed: floodQueryAllowed,
          queryGranularity: "polygon",
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
        flood: {
          dataVersion: floodResult.dataVersion,
          runId: floodResult.runId,
          sourceMode: floodResult.sourceMode,
          sourceVersion: floodResult.dataVersion,
          unavailableReason: floodResult.summary.unavailableReason,
          warnings: [...floodResult.warnings],
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
          warnings: [
            ...(colocationFacilitiesLimit.warning === null
              ? []
              : [colocationFacilitiesLimit.warning]),
            ...colocationResult.value.warnings,
            ...(hyperscaleFacilitiesLimit.warning === null
              ? []
              : [hyperscaleFacilitiesLimit.warning]),
            ...hyperscaleResult.value.warnings,
          ],
        },
        markets: {
          dataVersion: runtimeConfig.dataVersion,
          sourceMode: "postgis",
          sourceVersion: marketSourceVersion,
          unavailableReason: marketSelection.unavailableReason,
          warnings: marketsResult.ok
            ? [...marketsResult.value.warnings]
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
