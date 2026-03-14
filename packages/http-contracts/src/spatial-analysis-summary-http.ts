import {
  CommissionedSemanticSchema,
  LeaseOrOwnSchema,
} from "@map-migration/geo-kernel/commissioned-semantic";
import { FacilityPerspectiveSchema } from "@map-migration/geo-kernel/facility-perspective";
import { PointGeometrySchema, PolygonGeometrySchema } from "@map-migration/geo-kernel/geometry";
import { WarningSchema } from "@map-migration/geo-kernel/warning";
import { z } from "zod";
import { PolicyDatasetSchema, QueryGranularitySchema } from "./analysis-contracts.js";
import { ResponseMetaSchema } from "./api-response-meta.js";
import {
  CountyScoresResponseSchema,
  CountyScoresStatusResponseSchema,
} from "./county-intelligence-http.js";
import { MarketSelectionMatchSchema } from "./markets-selection-http.js";

const CountyFipsSchema = z.string().regex(/^[0-9]{5}$/);

export const SpatialAnalysisSummaryRequestSchema = z.object({
  geometry: PolygonGeometrySchema,
  includeFacilities: z.boolean().default(true),
  includeFlood: z.boolean().default(true),
  includeParcels: z.boolean().default(true),
  limitPerPerspective: z.number().int().positive().max(100_000).default(5000),
  minimumMarketSelectionOverlapPercent: z.number().min(0).max(1).default(0),
  parcelPageSize: z.number().int().positive().max(100_000).default(20_000),
  perspectives: z.array(FacilityPerspectiveSchema).max(2).default(["colocation", "hyperscale"]),
});

export const SpatialAnalysisSummaryFacilityRecordSchema = z.object({
  address: z.string().nullable(),
  availablePowerMw: z.number().nullable(),
  city: z.string().nullable(),
  commissionedPowerMw: z.number().nullable(),
  commissionedSemantic: CommissionedSemanticSchema,
  coordinates: PointGeometrySchema.shape.coordinates,
  countyFips: CountyFipsSchema.nullable(),
  facilityId: z.string().min(1),
  facilityName: z.string().min(1),
  leaseOrOwn: LeaseOrOwnSchema.nullable(),
  perspective: FacilityPerspectiveSchema,
  plannedPowerMw: z.number().nullable(),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  squareFootage: z.number().nullable(),
  state: z.string().nullable(),
  stateAbbrev: z.string().length(2).nullable(),
  statusLabel: z.string().nullable(),
  underConstructionPowerMw: z.number().nullable(),
});

export const SpatialAnalysisPerspectiveSummarySchema = z.object({
  availablePowerMw: z.number().nonnegative(),
  commissionedPowerMw: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  leasedCount: z.number().int().nonnegative(),
  operationalCount: z.number().int().nonnegative(),
  pipelinePowerMw: z.number().nonnegative(),
  plannedCount: z.number().int().nonnegative(),
  plannedPowerMw: z.number().nonnegative(),
  squareFootage: z.number().nonnegative(),
  underConstructionCount: z.number().int().nonnegative(),
  underConstructionPowerMw: z.number().nonnegative(),
  unknownCount: z.number().int().nonnegative(),
});

export const SpatialAnalysisProviderSummarySchema = z.object({
  commissionedPowerMw: z.number().nonnegative(),
  count: z.number().int().nonnegative(),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
});

export const SpatialAnalysisParcelRecordSchema = z.object({
  attrs: z.record(z.unknown()),
  coordinates: PointGeometrySchema.shape.coordinates.nullable(),
  geoid: z.string().nullable(),
  parcelId: z.string().min(1),
  state2: z.string().length(2).nullable(),
});

export const SpatialAnalysisParcelSelectionSummarySchema = z.object({
  count: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  parcels: z.array(SpatialAnalysisParcelRecordSchema),
  truncated: z.boolean(),
});

export const SpatialAnalysisMarketSelectionSummarySchema = z.object({
  markets: z.array(MarketSelectionMatchSchema),
  matchCount: z.number().int().nonnegative(),
  minimumSelectionOverlapPercent: z.number().min(0).max(1),
  primaryMarket: MarketSelectionMatchSchema.nullable(),
  selectionAreaSqKm: z.number().nonnegative(),
  unavailableReason: z.string().nullable(),
});

export const SpatialAnalysisFloodSummarySchema = z.object({
  flood100AreaSqKm: z.number().nonnegative(),
  flood100SelectionShare: z.number().min(0).max(1),
  flood500AreaSqKm: z.number().nonnegative(),
  flood500SelectionShare: z.number().min(0).max(1),
  parcelCountIntersectingFlood100: z.number().int().nonnegative(),
  parcelCountIntersectingFlood500: z.number().int().nonnegative(),
  parcelCountOutsideMappedFlood: z.number().int().nonnegative(),
  selectionAreaSqKm: z.number().nonnegative(),
  unavailableReason: z.string().nullable(),
});

export const SpatialAnalysisSelectionSummarySchema = z.object({
  colocation: SpatialAnalysisPerspectiveSummarySchema,
  countyIds: z.array(CountyFipsSchema),
  facilities: z.array(SpatialAnalysisSummaryFacilityRecordSchema),
  flood: SpatialAnalysisFloodSummarySchema,
  hyperscale: SpatialAnalysisPerspectiveSummarySchema,
  marketSelection: SpatialAnalysisMarketSelectionSummarySchema,
  parcelSelection: SpatialAnalysisParcelSelectionSummarySchema,
  topColocationProviders: z.array(SpatialAnalysisProviderSummarySchema),
  topHyperscaleProviders: z.array(SpatialAnalysisProviderSummarySchema),
  totalCount: z.number().int().nonnegative(),
});

export const SpatialAnalysisCountyScoresSchema = CountyScoresResponseSchema.omit({
  meta: true,
});

export const SpatialAnalysisCountyScoresStatusSchema = CountyScoresStatusResponseSchema.omit({
  meta: true,
});

export const SpatialAnalysisCountyIntelligenceSchema = z.object({
  requestedCountyIds: z.array(CountyFipsSchema),
  scores: SpatialAnalysisCountyScoresSchema.nullable(),
  status: SpatialAnalysisCountyScoresStatusSchema.nullable(),
  unavailableReason: z.string().nullable(),
});

export const SpatialAnalysisAreaSchema = z.object({
  countyIds: z.array(CountyFipsSchema),
  selectionAreaSqKm: z.number().nonnegative(),
});

export const SpatialAnalysisSummaryCoverageSchema = z.object({
  countyIntelligence: z.object({
    availableFeatureFamilies: z.array(z.string().min(1)),
    datasetAvailable: z.boolean(),
    missingFeatureFamilies: z.array(z.string().min(1)),
  }),
  flood: z.object({
    datasetAvailable: z.boolean(),
    included: z.boolean(),
    unavailableReason: z.string().nullable(),
  }),
  markets: z.object({
    boundarySourceAvailable: z.boolean(),
    unavailableReason: z.string().nullable(),
  }),
  parcels: z.object({
    included: z.boolean(),
    nextCursor: z.string().nullable(),
    truncated: z.boolean(),
  }),
});

export const SpatialAnalysisSummaryProvenanceSchema = z.object({
  countyIntelligence: z.object({
    dataVersion: z.string().nullable(),
    formulaVersion: z.string().nullable(),
    inputDataVersion: z.string().nullable(),
    methodologyId: z.string().nullable(),
    publicationRunId: z.string().nullable(),
    publishedAt: z.string().datetime().nullable(),
  }),
  flood: z.object({
    dataVersion: z.string().nullable(),
    runId: z.string().nullable(),
    sourceMode: ResponseMetaSchema.shape.sourceMode.nullable(),
    sourceVersion: z.string().nullable(),
    unavailableReason: z.string().nullable(),
    warnings: z.array(WarningSchema),
  }),
  facilities: z.object({
    countsByPerspective: z.object({
      colocation: z.number().int().nonnegative(),
      hyperscale: z.number().int().nonnegative(),
    }),
    dataVersion: z.string().min(1),
    sourceMode: ResponseMetaSchema.shape.sourceMode,
    truncatedByPerspective: z.object({
      colocation: z.boolean(),
      hyperscale: z.boolean(),
    }),
    warnings: z.array(WarningSchema),
  }),
  markets: z.object({
    dataVersion: z.string().min(1),
    sourceMode: ResponseMetaSchema.shape.sourceMode,
    sourceVersion: z.string().nullable(),
    unavailableReason: z.string().nullable(),
    warnings: z.array(WarningSchema),
  }),
  parcels: z.object({
    dataVersion: z.string().nullable(),
    ingestionRunId: z.string().nullable(),
    nextCursor: z.string().nullable(),
    sourceMode: ResponseMetaSchema.shape.sourceMode.nullable(),
    warnings: z.array(WarningSchema),
  }),
});

export const SpatialAnalysisPolicyEntrySchema = z.object({
  dataset: PolicyDatasetSchema,
  queryAllowed: z.boolean(),
  queryGranularity: QueryGranularitySchema,
});

export const SpatialAnalysisSummaryResponseSchema = z.object({
  area: SpatialAnalysisAreaSchema,
  countyIntelligence: SpatialAnalysisCountyIntelligenceSchema,
  coverage: SpatialAnalysisSummaryCoverageSchema,
  meta: ResponseMetaSchema,
  policy: z.object({
    countyIntelligence: SpatialAnalysisPolicyEntrySchema,
    flood: SpatialAnalysisPolicyEntrySchema,
    facilities: SpatialAnalysisPolicyEntrySchema,
    parcels: SpatialAnalysisPolicyEntrySchema,
  }),
  provenance: SpatialAnalysisSummaryProvenanceSchema,
  request: SpatialAnalysisSummaryRequestSchema,
  summary: SpatialAnalysisSelectionSummarySchema,
  warnings: z.array(WarningSchema),
});

export type SpatialAnalysisSummaryRequest = z.infer<typeof SpatialAnalysisSummaryRequestSchema>;
export type SpatialAnalysisSummaryFacilityRecord = z.infer<
  typeof SpatialAnalysisSummaryFacilityRecordSchema
>;
export type SpatialAnalysisPerspectiveSummary = z.infer<
  typeof SpatialAnalysisPerspectiveSummarySchema
>;
export type SpatialAnalysisProviderSummary = z.infer<typeof SpatialAnalysisProviderSummarySchema>;
export type SpatialAnalysisParcelRecord = z.infer<typeof SpatialAnalysisParcelRecordSchema>;
export type SpatialAnalysisFloodSummary = z.infer<typeof SpatialAnalysisFloodSummarySchema>;
export type SpatialAnalysisSelectionSummary = z.infer<typeof SpatialAnalysisSelectionSummarySchema>;
export type SpatialAnalysisCountyScores = z.infer<typeof SpatialAnalysisCountyScoresSchema>;
export type SpatialAnalysisCountyScoresStatus = z.infer<
  typeof SpatialAnalysisCountyScoresStatusSchema
>;
export type SpatialAnalysisCountyIntelligence = z.infer<
  typeof SpatialAnalysisCountyIntelligenceSchema
>;
export type SpatialAnalysisArea = z.infer<typeof SpatialAnalysisAreaSchema>;
export type SpatialAnalysisSummaryCoverage = z.infer<typeof SpatialAnalysisSummaryCoverageSchema>;
export type SpatialAnalysisSummaryProvenance = z.infer<
  typeof SpatialAnalysisSummaryProvenanceSchema
>;
export type SpatialAnalysisPolicyEntry = z.infer<typeof SpatialAnalysisPolicyEntrySchema>;
export type SpatialAnalysisSummaryResponse = z.infer<typeof SpatialAnalysisSummaryResponseSchema>;
