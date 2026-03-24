import type { Warning } from "@map-migration/geo-kernel/warning";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import {
  type SpatialAnalysisCountyScores,
  SpatialAnalysisCountyScoresSchema,
  type SpatialAnalysisCountyScoresStatus,
  SpatialAnalysisCountyScoresStatusSchema,
  type SpatialAnalysisFloodSummary,
  type SpatialAnalysisParcelRecord,
  type SpatialAnalysisPerspectiveSummary,
  type SpatialAnalysisProviderSummary,
  type SpatialAnalysisSelectionSummary,
  type SpatialAnalysisSummaryFacilityRecord,
  type SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type {
  QuerySpatialAnalysisSummaryArgs,
  QuerySpatialAnalysisSummaryResult,
} from "./analysis-summary.service.types";
import type {
  AnalysisSummaryPorts,
  FacilitiesLimitResolution,
  MarketBoundarySourceVersionResult,
  MarketSelectionResult,
  SelectionAreaAndCountyIdsResult,
} from "./ports/analysis-summary-ports";

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

function readNullableFacilityNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableFacilityText(value: string | null | undefined): string | null {
  return typeof value === "string" ? value : null;
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
    address: readNullableFacilityText(feature.properties.address),
    availablePowerMw: readNullableFacilityNumber(feature.properties.availablePowerMw),
    city: readNullableFacilityText(feature.properties.city),
    commissionedPowerMw: readNullableFacilityNumber(feature.properties.commissionedPowerMw),
    commissionedSemantic: feature.properties.commissionedSemantic,
    coordinates,
    countyFips: normalizeCountyFips(feature.properties.countyFips),
    facilityId: feature.properties.facilityId,
    facilityName: resolveDisplayName(feature.properties.facilityName, "Unknown facility"),
    leaseOrOwn: feature.properties.leaseOrOwn,
    perspective: feature.properties.perspective,
    plannedPowerMw: readNullableFacilityNumber(feature.properties.plannedPowerMw),
    providerId: feature.properties.providerId,
    providerName: resolveDisplayName(feature.properties.providerName, "Unknown provider"),
    squareFootage: readNullableFacilityNumber(feature.properties.squareFootage),
    state: readNullableFacilityText(feature.properties.state),
    stateAbbrev: readNullableFacilityText(feature.properties.stateAbbrev),
    statusLabel: readNullableFacilityText(feature.properties.statusLabel),
    underConstructionPowerMw: readNullableFacilityNumber(
      feature.properties.underConstructionPowerMw
    ),
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
  readonly marketInsight: SpatialAnalysisSelectionSummary["marketInsight"];
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
    marketInsight: args.marketInsight,
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

function validateCountyScoresPayload(
  payload: SpatialAnalysisCountyScores
): SpatialAnalysisCountyScores | null {
  const parsed = SpatialAnalysisCountyScoresSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

function validateCountyScoresStatusPayload(
  payload: SpatialAnalysisCountyScoresStatus
): SpatialAnalysisCountyScoresStatus | null {
  const parsed = SpatialAnalysisCountyScoresStatusSchema.safeParse(payload);
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

type SummaryFailure = Extract<QuerySpatialAnalysisSummaryResult, { ok: false }>;
type SummaryFailureReason = SummaryFailure["value"]["reason"];

interface AnalysisDatasetPolicies {
  readonly countyIntelligenceQueryAllowed: boolean;
  readonly facilitiesQueryAllowed: boolean;
  readonly floodQueryAllowed: boolean;
  readonly parcelsQueryAllowed: boolean;
}

interface PreparedSelectionRequest {
  readonly colocationFacilitiesLimit: FacilitiesLimitResolution;
  readonly geometryWarnings: readonly Warning[];
  readonly hyperscaleFacilitiesLimit: FacilitiesLimitResolution;
  readonly normalizedGeometryText: string;
  readonly parcelPolicyWarning: Warning | null;
  readonly policies: AnalysisDatasetPolicies;
  readonly shouldQueryColocation: boolean;
  readonly shouldQueryHyperscale: boolean;
}

interface FloodSliceResult {
  readonly datasetAvailable: boolean;
  readonly dataVersion: string | null;
  readonly runId: string | null;
  readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null;
  readonly summary: SpatialAnalysisFloodSummary;
  readonly warnings: readonly Warning[];
}

interface FacilitiesSliceResult {
  readonly features: FacilitiesFeatureCollection["features"];
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}

interface ParcelSliceResult {
  readonly dataVersion: string | null;
  readonly features: ParcelsFeatureCollection["features"];
  readonly ingestionRunId: string | null;
  readonly nextCursor: string | null;
  readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"] | null;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
}

interface CollectedAnalysisSlices {
  readonly colocationResult: FacilitiesSliceResult;
  readonly countyAreaResult: SelectionAreaAndCountyIdsResult;
  readonly countyStatusResult: Awaited<ReturnType<AnalysisSummaryPorts["queryCountyScoresStatus"]>>;
  readonly floodResult: FloodSliceResult;
  readonly hyperscaleResult: FacilitiesSliceResult;
  readonly marketBoundarySourceVersionResult: MarketBoundarySourceVersionResult;
  readonly marketsResult: MarketSelectionResult;
  readonly parcelResult: ParcelSliceResult;
  readonly warnings: readonly Warning[];
}

interface SelectionSummaryAssembly {
  readonly countyIds: readonly string[];
  readonly marketSelection: SpatialAnalysisSelectionSummary["marketSelection"];
  readonly selectionAreaSqKm: number;
  readonly summary: SpatialAnalysisSelectionSummary;
  readonly warnings: readonly Warning[];
}

async function attachMarketInsightToSelection(args: {
  readonly ports: AnalysisSummaryPorts;
  readonly selection: SelectionSummaryAssembly;
}): Promise<SelectionSummaryAssembly> {
  const primaryMarket = args.selection.marketSelection.primaryMarket;
  if (args.selection.marketSelection.matchCount !== 1 || primaryMarket === null) {
    return args.selection;
  }

  const marketInsightResult = await args.ports.queryMarketInsightByMarketId({
    marketId: primaryMarket.marketId,
  });
  if (!marketInsightResult.ok) {
    return {
      ...args.selection,
      warnings: [
        ...args.selection.warnings,
        buildWarning(
          marketInsightResult.value.reason === "source_unavailable"
            ? "MARKET_INSIGHT_SOURCE_UNAVAILABLE"
            : "MARKET_INSIGHT_QUERY_FAILED",
          marketInsightResult.value.reason === "source_unavailable"
            ? "Canonical market insight views are unavailable for this selection."
            : "Canonical market insight metrics could not be loaded for this selection."
        ),
      ],
    };
  }

  return {
    ...args.selection,
    summary: {
      ...args.selection.summary,
      marketInsight: marketInsightResult.value,
    },
  };
}

interface CountyIntelligenceAssembly {
  readonly countyQueryAllowed: boolean;
  readonly countyScores: SpatialAnalysisCountyScores | null;
  readonly countyStatus: SpatialAnalysisCountyScoresStatus | null;
  readonly countyUnavailableReason: string | null;
  readonly warnings: readonly Warning[];
}

function failSummary(reason: SummaryFailureReason, error: unknown): SummaryFailure {
  return {
    ok: false,
    value: {
      error,
      reason,
    },
  };
}

function emptyFacilitiesResult(): FacilitiesSliceResult {
  return {
    features: [],
    truncated: false,
    warnings: [],
  };
}

function createFloodSlice(args: {
  readonly floodQueryAllowed: boolean;
  readonly includeFlood: boolean;
  readonly normalizedGeometryText: string;
  readonly ports: AnalysisSummaryPorts;
  readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
}): Promise<FloodSliceResult> {
  if (!args.includeFlood) {
    return Promise.resolve({
      dataVersion: null,
      datasetAvailable: false,
      runId: null,
      sourceMode: null,
      summary: emptyFloodSummary(null),
      warnings: [],
    });
  }

  if (!args.floodQueryAllowed) {
    const unavailableReason = 'query granularity "polygon" is not allowed for environmental_flood';
    return Promise.resolve({
      dataVersion: null,
      datasetAvailable: false,
      runId: null,
      sourceMode: null,
      summary: emptyFloodSummary(unavailableReason),
      warnings: [buildWarning("FLOOD_POLICY_REJECTED", unavailableReason)],
    });
  }

  return args.ports
    .queryFloodAnalysis({ geometryGeoJson: args.normalizedGeometryText })
    .then((result) => {
      if (result.ok) {
        return {
          dataVersion: result.value.dataVersion,
          datasetAvailable: true,
          runId: result.value.runId,
          sourceMode: args.sourceMode,
          summary: result.value.summary,
          warnings: [],
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
        sourceMode: null,
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
}

function buildMarketSelection(args: {
  readonly marketsResult: MarketSelectionResult;
  readonly minimumSelectionOverlapPercent: number;
}): {
  readonly selection: SpatialAnalysisSelectionSummary["marketSelection"];
  readonly warnings: readonly Warning[];
} {
  if (args.marketsResult.ok) {
    return {
      selection: {
        markets: [...args.marketsResult.value.matchedMarkets],
        matchCount: args.marketsResult.value.matchedMarkets.length,
        minimumSelectionOverlapPercent: args.minimumSelectionOverlapPercent,
        primaryMarket: args.marketsResult.value.primaryMarket,
        selectionAreaSqKm: args.marketsResult.value.selectionAreaSqKm,
        unavailableReason: null,
      },
      warnings: [],
    };
  }

  const unavailableReason =
    args.marketsResult.value.reason === "boundary_source_unavailable"
      ? "Market boundary dataset is unavailable."
      : "Market selection query failed.";

  return {
    selection: {
      markets: [],
      matchCount: 0,
      minimumSelectionOverlapPercent: args.minimumSelectionOverlapPercent,
      primaryMarket: null,
      selectionAreaSqKm: 0,
      unavailableReason,
    },
    warnings: [
      buildWarning(
        args.marketsResult.value.reason === "boundary_source_unavailable"
          ? "MARKET_BOUNDARY_SOURCE_UNAVAILABLE"
          : "MARKET_SELECTION_FAILED",
        unavailableReason
      ),
    ],
  };
}

async function prepareSelectionRequest(
  args: QuerySpatialAnalysisSummaryArgs,
  ports: AnalysisSummaryPorts
): Promise<{ readonly ok: true; readonly value: PreparedSelectionRequest } | SummaryFailure> {
  const policies: AnalysisDatasetPolicies = {
    countyIntelligenceQueryAllowed: ports.isDatasetQueryAllowed({
      dataset: "county_scores",
      queryGranularity: "county",
    }),
    facilitiesQueryAllowed: ports.isDatasetQueryAllowed({
      dataset: "facilities",
      queryGranularity: "polygon",
    }),
    floodQueryAllowed: ports.isDatasetQueryAllowed({
      dataset: "environmental_flood",
      queryGranularity: "polygon",
    }),
    parcelsQueryAllowed: ports.isDatasetQueryAllowed({
      dataset: "parcels",
      queryGranularity: "polygon",
    }),
  };

  if (!policies.facilitiesQueryAllowed) {
    return failSummary(
      "facilities_policy_rejected",
      new Error('query granularity "polygon" is not allowed for facilities')
    );
  }

  if (args.request.includeParcels && !policies.parcelsQueryAllowed) {
    return failSummary(
      "parcels_policy_rejected",
      new Error('query granularity "polygon" is not allowed for parcels')
    );
  }

  const facilitiesGeometry = ports.resolveFacilitiesGeometry(args.request.geometry);
  if (ports.facilitiesBboxExceedsLimits(facilitiesGeometry.bbox)) {
    return failSummary(
      "facilities_policy_rejected",
      new Error("selection polygon AOI exceeds the facilities analysis extent limit")
    );
  }

  if (facilitiesGeometry.geometryText.length > ports.facilitiesMaxPolygonJsonChars) {
    return failSummary(
      "facilities_policy_rejected",
      new Error("selection polygon AOI payload is too large")
    );
  }

  try {
    const normalizedGeometry = await ports.normalizeSelectionGeometry(
      facilitiesGeometry.geometryText
    );
    const requestedPerspectives = new Set(args.request.perspectives);

    return {
      ok: true,
      value: {
        colocationFacilitiesLimit: ports.resolveFacilitiesLimit({
          perspective: "colocation",
          requestedLimit: args.request.limitPerPerspective,
        }),
        geometryWarnings: normalizedGeometry.warning === null ? [] : [normalizedGeometry.warning],
        hyperscaleFacilitiesLimit: ports.resolveFacilitiesLimit({
          perspective: "hyperscale",
          requestedLimit: args.request.limitPerPerspective,
        }),
        normalizedGeometryText: normalizedGeometry.geometryText,
        parcelPolicyWarning: ports.resolveParcelPolicyWarning({
          geometry: {
            type: "polygon",
            geometry: args.request.geometry,
          },
          includeParcels: args.request.includeParcels,
        }),
        policies,
        shouldQueryColocation: requestedPerspectives.has("colocation"),
        shouldQueryHyperscale: requestedPerspectives.has("hyperscale"),
      },
    };
  } catch (error) {
    return failSummary("facilities_policy_rejected", error);
  }
}

async function collectAnalysisSlices(args: {
  readonly input: QuerySpatialAnalysisSummaryArgs;
  readonly ports: AnalysisSummaryPorts;
  readonly prepared: PreparedSelectionRequest;
}): Promise<{ readonly ok: true; readonly value: CollectedAnalysisSlices } | SummaryFailure> {
  const runtimeMetadata = args.ports.getRuntimeMetadata();
  const parcelResultPromise = (() => {
    if (!args.input.request.includeParcels) {
      return Promise.resolve({
        ok: true as const,
        value: emptyParcelQueryValue({}),
      });
    }

    if (args.prepared.parcelPolicyWarning !== null) {
      return Promise.resolve({
        ok: true as const,
        value: emptyParcelQueryValue({
          warnings: [args.prepared.parcelPolicyWarning],
        }),
      });
    }

    return args.ports.queryParcels({
      expectedIngestionRunId: args.input.expectedParcelIngestionRunId,
      geometryText: args.prepared.normalizedGeometryText,
      includeGeometry: "centroid",
      pageSize: args.input.request.parcelPageSize,
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
    args.prepared.shouldQueryColocation && args.input.request.includeFacilities
      ? args.ports.queryFacilitiesByPolygon({
          geometryGeoJson: args.prepared.normalizedGeometryText,
          limit: args.prepared.colocationFacilitiesLimit.limit,
          perspective: "colocation",
        })
      : Promise.resolve({
          ok: true as const,
          value: emptyFacilitiesResult(),
        }),
    createFloodSlice({
      floodQueryAllowed: args.prepared.policies.floodQueryAllowed,
      includeFlood: args.input.request.includeFlood,
      normalizedGeometryText: args.prepared.normalizedGeometryText,
      ports: args.ports,
      sourceMode: runtimeMetadata.floodSourceMode,
    }),
    args.prepared.shouldQueryHyperscale && args.input.request.includeFacilities
      ? args.ports.queryFacilitiesByPolygon({
          geometryGeoJson: args.prepared.normalizedGeometryText,
          limit: args.prepared.hyperscaleFacilitiesLimit.limit,
          perspective: "hyperscale",
        })
      : Promise.resolve({
          ok: true as const,
          value: emptyFacilitiesResult(),
        }),
    args.ports.queryMarketsBySelection({
      geometryGeoJson: args.prepared.normalizedGeometryText,
      limit: 25,
      minimumSelectionOverlapPercent: args.input.request.minimumMarketSelectionOverlapPercent,
    }),
    parcelResultPromise,
    args.ports.queryCountyScoresStatus(),
    args.ports.lookupSelectionAreaAndCountyIds(args.prepared.normalizedGeometryText),
    args.ports.lookupMarketBoundarySourceVersion(),
  ]);

  if (!colocationResult.ok) {
    return failSummary(
      colocationResult.value.reason === "mapping_failed"
        ? "facilities_mapping_failed"
        : "facilities_query_failed",
      colocationResult.value.error
    );
  }

  if (!hyperscaleResult.ok) {
    return failSummary(
      hyperscaleResult.value.reason === "mapping_failed"
        ? "facilities_mapping_failed"
        : "facilities_query_failed",
      hyperscaleResult.value.error
    );
  }

  if (!parcelResult.ok) {
    return failSummary(parcelResult.value.reason, parcelResult.value.error);
  }

  return {
    ok: true,
    value: {
      colocationResult: colocationResult.value,
      countyAreaResult,
      countyStatusResult,
      floodResult,
      hyperscaleResult: hyperscaleResult.value,
      marketBoundarySourceVersionResult,
      marketsResult,
      parcelResult: parcelResult.value,
      warnings: [
        ...args.prepared.geometryWarnings,
        ...(args.prepared.colocationFacilitiesLimit.warning === null
          ? []
          : [args.prepared.colocationFacilitiesLimit.warning]),
        ...colocationResult.value.warnings,
        ...floodResult.warnings,
        ...(args.prepared.hyperscaleFacilitiesLimit.warning === null
          ? []
          : [args.prepared.hyperscaleFacilitiesLimit.warning]),
        ...hyperscaleResult.value.warnings,
        ...(marketsResult.ok ? marketsResult.value.warnings : []),
        ...parcelResult.value.warnings,
      ],
    },
  };
}

function assembleSelectionSummary(args: {
  readonly input: QuerySpatialAnalysisSummaryArgs;
  readonly slices: CollectedAnalysisSlices;
}): SelectionSummaryAssembly {
  const marketSelectionResult = buildMarketSelection({
    marketsResult: args.slices.marketsResult,
    minimumSelectionOverlapPercent: args.input.request.minimumMarketSelectionOverlapPercent,
  });
  const countyIdsFromGeometry = args.slices.countyAreaResult.ok
    ? args.slices.countyAreaResult.value.countyIds
    : [];
  const selectionAreaSqKm = args.slices.countyAreaResult.ok
    ? args.slices.countyAreaResult.value.selectionAreaSqKm
    : marketSelectionResult.selection.selectionAreaSqKm;
  const provisionalSummary = buildSelectionSummary({
    colocationFeatures: args.slices.colocationResult.features,
    countyIds: countyIdsFromGeometry,
    flood: args.slices.floodResult.summary,
    hyperscaleFeatures: args.slices.hyperscaleResult.features,
    marketInsight: null,
    marketSelection: marketSelectionResult.selection,
    parcelFeatures: args.slices.parcelResult.features,
    parcelNextCursor: args.slices.parcelResult.nextCursor,
    parcelTruncated: args.slices.parcelResult.truncated,
  });
  const countyIds =
    countyIdsFromGeometry.length > 0
      ? countyIdsFromGeometry
      : deriveCountyIdsFromFeatures({
          facilities: provisionalSummary.facilities,
          parcels: provisionalSummary.parcelSelection.parcels,
        });
  const summary =
    provisionalSummary.countyIds.length === countyIds.length
      ? provisionalSummary
      : buildSelectionSummary({
          colocationFeatures: args.slices.colocationResult.features,
          countyIds,
          flood: args.slices.floodResult.summary,
          hyperscaleFeatures: args.slices.hyperscaleResult.features,
          marketInsight: null,
          marketSelection: marketSelectionResult.selection,
          parcelFeatures: args.slices.parcelResult.features,
          parcelNextCursor: args.slices.parcelResult.nextCursor,
          parcelTruncated: args.slices.parcelResult.truncated,
        });

  return {
    countyIds,
    marketSelection: marketSelectionResult.selection,
    selectionAreaSqKm: Number.isFinite(selectionAreaSqKm) ? selectionAreaSqKm : 0,
    summary,
    warnings: [
      ...marketSelectionResult.warnings,
      ...(!args.slices.countyAreaResult.ok && countyIds.length > 0
        ? [
            buildWarning(
              "COUNTY_BOUNDARY_LOOKUP_FAILED",
              "County boundary lookup failed; county ids were derived from facility and parcel results."
            ),
          ]
        : []),
      ...(!args.slices.countyAreaResult.ok &&
      args.slices.countyAreaResult.value.reason === "source_unavailable"
        ? [
            buildWarning(
              "COUNTY_BOUNDARY_SOURCE_UNAVAILABLE",
              "County boundary dataset is unavailable; county ids were derived from available analysis records."
            ),
          ]
        : []),
    ],
  };
}

async function assembleCountyIntelligence(args: {
  readonly countyIds: readonly string[];
  readonly countyStatusResult: Awaited<ReturnType<AnalysisSummaryPorts["queryCountyScoresStatus"]>>;
  readonly ports: AnalysisSummaryPorts;
  readonly queryAllowed: boolean;
}): Promise<CountyIntelligenceAssembly> {
  let countyScores: SpatialAnalysisCountyScores | null = null;
  let countyStatus: SpatialAnalysisCountyScoresStatus | null = null;
  let countyUnavailableReason: string | null = null;
  const warnings: Warning[] = [];

  if (args.countyStatusResult.ok) {
    const countyStatusPayload: SpatialAnalysisCountyScoresStatus = {
      ...args.countyStatusResult.value,
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

  if (!args.queryAllowed) {
    countyUnavailableReason = 'query granularity "county" is not allowed for county_scores';
    warnings.push(buildWarning("COUNTY_INTELLIGENCE_POLICY_REJECTED", countyUnavailableReason));
  } else if (args.countyIds.length > 0) {
    const countyScoresResult = await args.ports.queryCountyScores({
      countyIds: args.countyIds,
    });

    if (countyScoresResult.ok) {
      const countyScoresPayload: SpatialAnalysisCountyScores = {
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

  return {
    countyQueryAllowed: args.queryAllowed,
    countyScores,
    countyStatus,
    countyUnavailableReason,
    warnings,
  };
}

function buildResponseWarnings(args: {
  readonly countyIntelligence: CountyIntelligenceAssembly;
  readonly selection: SelectionSummaryAssembly;
  readonly slices: CollectedAnalysisSlices;
}): readonly Warning[] {
  return [
    ...args.slices.warnings,
    ...args.selection.warnings,
    ...args.countyIntelligence.warnings,
    ...(!args.slices.marketBoundarySourceVersionResult.ok &&
    args.slices.marketBoundarySourceVersionResult.value.reason === "source_unavailable"
      ? [
          buildWarning(
            "MARKET_BOUNDARY_SOURCE_UNAVAILABLE",
            "Market boundary provenance is unavailable because the boundary source is missing."
          ),
        ]
      : []),
  ];
}

function buildMarketWarnings(args: {
  readonly marketSelection: SpatialAnalysisSelectionSummary["marketSelection"];
  readonly marketsResult: MarketSelectionResult;
}): readonly Warning[] {
  return args.marketsResult.ok
    ? [...args.marketsResult.value.warnings]
    : [
        buildWarning(
          args.marketSelection.unavailableReason === "Market boundary dataset is unavailable."
            ? "MARKET_BOUNDARY_SOURCE_UNAVAILABLE"
            : "MARKET_SELECTION_FAILED",
          args.marketSelection.unavailableReason ?? "Market selection is unavailable."
        ),
      ];
}

function assembleAnalysisResponse(args: {
  readonly countyIntelligence: CountyIntelligenceAssembly;
  readonly input: QuerySpatialAnalysisSummaryArgs;
  readonly prepared: PreparedSelectionRequest;
  readonly runtimeMetadata: ReturnType<AnalysisSummaryPorts["getRuntimeMetadata"]>;
  readonly selection: SelectionSummaryAssembly;
  readonly slices: CollectedAnalysisSlices;
}): QuerySpatialAnalysisSummaryResult {
  const warnings = buildResponseWarnings({
    countyIntelligence: args.countyIntelligence,
    selection: args.selection,
    slices: args.slices,
  });
  const marketSourceVersion = args.slices.marketBoundarySourceVersionResult.ok
    ? args.slices.marketBoundarySourceVersionResult.value
    : null;
  const boundarySourceAvailable = args.slices.marketsResult.ok
    ? true
    : args.slices.marketsResult.value.reason !== "boundary_source_unavailable";
  const marketWarnings = buildMarketWarnings({
    marketSelection: args.selection.marketSelection,
    marketsResult: args.slices.marketsResult,
  });

  return {
    ok: true,
    value: {
      area: {
        countyIds: [...args.selection.countyIds],
        selectionAreaSqKm: args.selection.selectionAreaSqKm,
      },
      countyIntelligence: {
        requestedCountyIds: [...args.selection.countyIds],
        scores: args.countyIntelligence.countyScores,
        status: args.countyIntelligence.countyStatus,
        unavailableReason: args.countyIntelligence.countyUnavailableReason,
      },
      coverage: {
        countyIntelligence: {
          availableFeatureFamilies: [
            ...(args.countyIntelligence.countyStatus?.availableFeatureFamilies ?? []),
          ],
          datasetAvailable: args.countyIntelligence.countyStatus?.datasetAvailable ?? false,
          missingFeatureFamilies: [
            ...(args.countyIntelligence.countyStatus?.missingFeatureFamilies ?? []),
          ],
        },
        flood: {
          datasetAvailable: args.slices.floodResult.datasetAvailable,
          included: args.input.request.includeFlood && args.prepared.policies.floodQueryAllowed,
          unavailableReason: args.slices.floodResult.summary.unavailableReason,
        },
        markets: {
          boundarySourceAvailable,
          unavailableReason: args.selection.marketSelection.unavailableReason,
        },
        parcels: {
          included: args.input.request.includeParcels && args.prepared.parcelPolicyWarning === null,
          nextCursor: args.slices.parcelResult.nextCursor,
          truncated: args.slices.parcelResult.truncated,
        },
      },
      policy: {
        countyIntelligence: {
          dataset: "county_scores",
          queryAllowed: args.prepared.policies.countyIntelligenceQueryAllowed,
          queryGranularity: "county",
        },
        flood: {
          dataset: "environmental_flood",
          queryAllowed: args.prepared.policies.floodQueryAllowed,
          queryGranularity: "polygon",
        },
        facilities: {
          dataset: "facilities",
          queryAllowed: args.prepared.policies.facilitiesQueryAllowed,
          queryGranularity: "polygon",
        },
        parcels: {
          dataset: "parcels",
          queryAllowed: args.prepared.policies.parcelsQueryAllowed,
          queryGranularity: "polygon",
        },
      },
      provenance: {
        countyIntelligence: {
          dataVersion: args.countyIntelligence.countyStatus?.dataVersion ?? null,
          formulaVersion: args.countyIntelligence.countyStatus?.formulaVersion ?? null,
          inputDataVersion: args.countyIntelligence.countyStatus?.inputDataVersion ?? null,
          methodologyId: args.countyIntelligence.countyStatus?.methodologyId ?? null,
          publicationRunId: args.countyIntelligence.countyStatus?.publicationRunId ?? null,
          publishedAt: args.countyIntelligence.countyStatus?.publishedAt ?? null,
        },
        flood: {
          dataVersion: args.slices.floodResult.dataVersion,
          runId: args.slices.floodResult.runId,
          sourceMode: args.slices.floodResult.sourceMode,
          sourceVersion: args.slices.floodResult.dataVersion,
          unavailableReason: args.slices.floodResult.summary.unavailableReason,
          warnings: [...args.slices.floodResult.warnings],
        },
        facilities: {
          countsByPerspective: {
            colocation: args.slices.colocationResult.features.length,
            hyperscale: args.slices.hyperscaleResult.features.length,
          },
          dataVersion: args.runtimeMetadata.facilitiesDataVersion,
          sourceMode: args.runtimeMetadata.facilitiesSourceMode,
          truncatedByPerspective: {
            colocation: args.slices.colocationResult.truncated,
            hyperscale: args.slices.hyperscaleResult.truncated,
          },
          warnings: [
            ...(args.prepared.colocationFacilitiesLimit.warning === null
              ? []
              : [args.prepared.colocationFacilitiesLimit.warning]),
            ...args.slices.colocationResult.warnings,
            ...(args.prepared.hyperscaleFacilitiesLimit.warning === null
              ? []
              : [args.prepared.hyperscaleFacilitiesLimit.warning]),
            ...args.slices.hyperscaleResult.warnings,
          ],
        },
        markets: {
          dataVersion: args.runtimeMetadata.marketsDataVersion,
          sourceMode: args.runtimeMetadata.marketsSourceMode,
          sourceVersion: marketSourceVersion,
          unavailableReason: args.selection.marketSelection.unavailableReason,
          warnings: [...marketWarnings],
        },
        parcels: {
          dataVersion: args.slices.parcelResult.dataVersion,
          ingestionRunId: args.slices.parcelResult.ingestionRunId,
          nextCursor: args.slices.parcelResult.nextCursor,
          sourceMode: args.slices.parcelResult.sourceMode,
          warnings: [...args.slices.parcelResult.warnings],
        },
      },
      request: args.input.request,
      summary: args.selection.summary,
      warnings: [...warnings],
    },
  };
}

export async function querySpatialAnalysisSummary(
  args: QuerySpatialAnalysisSummaryArgs,
  ports: AnalysisSummaryPorts
): Promise<QuerySpatialAnalysisSummaryResult> {
  const preparedResult = await prepareSelectionRequest(args, ports);
  if (!preparedResult.ok) {
    return preparedResult;
  }

  const collectedResult = await collectAnalysisSlices({
    input: args,
    ports,
    prepared: preparedResult.value,
  });
  if (!collectedResult.ok) {
    return collectedResult;
  }

  const runtimeMetadata = ports.getRuntimeMetadata();
  const selectionWithoutInsight = assembleSelectionSummary({
    input: args,
    slices: collectedResult.value,
  });
  const selection = await attachMarketInsightToSelection({
    ports,
    selection: selectionWithoutInsight,
  });
  const countyIntelligence = await assembleCountyIntelligence({
    countyIds: selection.countyIds,
    countyStatusResult: collectedResult.value.countyStatusResult,
    ports,
    queryAllowed: preparedResult.value.policies.countyIntelligenceQueryAllowed,
  });

  return assembleAnalysisResponse({
    countyIntelligence,
    input: args,
    prepared: preparedResult.value,
    runtimeMetadata,
    selection,
    slices: collectedResult.value,
  });
}
