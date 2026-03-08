import { z } from "zod";
import { ParcelAoiSchema, ParcelFeatureSchema } from "./parcels-contracts";
import {
  ApiErrorResponseSchema,
  FacilityPerspectiveSchema,
  GeometrySchema,
  ResponseMetaSchema,
} from "./shared-contracts";

export const ParcelScoreConstraintSchema = z.object({
  key: z.string().min(1),
  passed: z.boolean(),
  reason: z.string().min(1).optional(),
});

export const ParcelScoreComponentSchema = z.object({
  key: z.string().min(1),
  weight: z.number(),
  rawValue: z.unknown(),
  normalizedValue: z.number(),
  contribution: z.number(),
  confidence: z.number(),
});

export const ScoredParcelSchema = z.object({
  parcel: ParcelFeatureSchema,
  scoreTotal: z.number(),
  confidenceScore: z.number(),
  constraints: z.array(ParcelScoreConstraintSchema),
  components: z.array(ParcelScoreComponentSchema),
  provenance: z.object({
    modelId: z.string().min(1),
    modelVersion: z.number().int().nonnegative(),
    ingestionRunId: z.string().min(1),
    boundarySetId: z.string().min(1).optional(),
    boundarySetVersion: z.number().int().nonnegative().optional(),
  }),
});

export const ParcelScoreRequestSchema = z.object({
  aoi: ParcelAoiSchema,
  modelId: z.string().min(1),
  modelVersion: z.number().int().nonnegative(),
  overrides: z.record(z.unknown()).optional(),
});

export const ParcelScoreResponseSchema = z.object({
  status: z.literal("ok"),
  results: z.array(ScoredParcelSchema),
  meta: ResponseMetaSchema,
});

export const ProximityTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("parcel"),
    parcelId: z.string().min(1),
  }),
  z.object({
    type: z.literal("facility"),
    facilityId: z.string().min(1),
    perspective: FacilityPerspectiveSchema,
  }),
  z.object({
    type: z.literal("geometry"),
    geometry: GeometrySchema,
  }),
]);

export const ProximityNeighborTypeSchema = z.enum([
  "power_substation",
  "fiber_metro",
  "fiber_longhaul",
  "facility_colocation",
  "facility_hyperscale",
]);

export const ProximityRequestSchema = z.object({
  target: ProximityTargetSchema,
  neighborTypes: z.array(ProximityNeighborTypeSchema).min(1),
  limit: z.number().int().positive().max(50).default(5),
});

export const ProximityNeighborSchema = z.object({
  neighborType: ProximityNeighborTypeSchema,
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  distanceMeters: z.number().nonnegative(),
  bearingDegrees: z.number(),
  confidence: z.number().optional(),
});

export const ProximityResponseSchema = z.object({
  status: z.literal("ok"),
  neighbors: z.array(ProximityNeighborSchema),
  meta: ResponseMetaSchema,
});

export const AnalysisErrorResponseSchema = ApiErrorResponseSchema;

export const MarketMetricKeySchema = z.enum(["market_size", "absorption", "vacancy"]);
export const MetricTimeWindowSchema = z.enum(["monthly", "quarterly", "trailing_12_month"]);
export const MetricAggregationGrainSchema = z.enum(["county", "market", "state", "country"]);
export const MetricNullHandlingSchema = z.enum(["exclude", "coalesce_zero", "error"]);

export const MarketMetricDefinitionSchema = z.object({
  key: MarketMetricKeySchema,
  canonicalFormula: z.string().min(1),
  timeWindow: MetricTimeWindowSchema,
  aggregationGrain: MetricAggregationGrainSchema,
  nullHandling: MetricNullHandlingSchema,
  owner: z.string().min(1),
  dueDate: z.string().date(),
});

export const MarketMetricDefinitionsSchema = z.object({
  market_size: MarketMetricDefinitionSchema.extend({
    key: z.literal("market_size"),
  }),
  absorption: MarketMetricDefinitionSchema.extend({
    key: z.literal("absorption"),
  }),
  vacancy: MarketMetricDefinitionSchema.extend({
    key: z.literal("vacancy"),
  }),
});

export const PolicyDatasetSchema = z.enum([
  "county_scores",
  "parcels",
  "facilities",
  "power",
  "fiber",
  "market_metrics",
]);
export const PolicySensitivityTierSchema = z.enum(["public", "internal", "restricted"]);
export const QueryGranularitySchema = z.enum([
  "bbox",
  "polygon",
  "county",
  "tileSet",
  "parcel",
  "facility",
  "market",
  "state",
  "country",
]);
export const ExportGranularitySchema = z.enum([
  "none",
  "parcel",
  "facility",
  "county",
  "market",
  "state",
  "country",
]);
export const RedistributionPolicySchema = z.enum(["none", "internal", "partner", "public"]);

export const DatasetLicensingPolicySchema = z.object({
  dataset: PolicyDatasetSchema,
  sensitivityTier: PolicySensitivityTierSchema,
  allowedQueryGranularities: z.array(QueryGranularitySchema).min(1),
  allowedExportGranularities: z.array(ExportGranularitySchema).min(1),
  minimumKAnonymity: z.number().int().positive().nullable(),
  cacheTtlSeconds: z.number().int().positive(),
  retentionDays: z.number().int().positive(),
  redistribution: RedistributionPolicySchema,
  owner: z.string().min(1),
  dueDate: z.string().date(),
});

export const SpatialAnalysisPolicySchema = z.object({
  marketMetrics: MarketMetricDefinitionsSchema,
  licensing: z.array(DatasetLicensingPolicySchema).min(1),
});

export type ParcelScoreConstraint = z.infer<typeof ParcelScoreConstraintSchema>;
export type ParcelScoreComponent = z.infer<typeof ParcelScoreComponentSchema>;
export type ScoredParcel = z.infer<typeof ScoredParcelSchema>;
export type ParcelScoreRequest = z.infer<typeof ParcelScoreRequestSchema>;
export type ParcelScoreResponse = z.infer<typeof ParcelScoreResponseSchema>;
export type ProximityTarget = z.infer<typeof ProximityTargetSchema>;
export type ProximityNeighborType = z.infer<typeof ProximityNeighborTypeSchema>;
export type ProximityRequest = z.infer<typeof ProximityRequestSchema>;
export type ProximityNeighbor = z.infer<typeof ProximityNeighborSchema>;
export type ProximityResponse = z.infer<typeof ProximityResponseSchema>;
export type AnalysisErrorResponse = z.infer<typeof AnalysisErrorResponseSchema>;
export type MarketMetricKey = z.infer<typeof MarketMetricKeySchema>;
export type MetricTimeWindow = z.infer<typeof MetricTimeWindowSchema>;
export type MetricAggregationGrain = z.infer<typeof MetricAggregationGrainSchema>;
export type MetricNullHandling = z.infer<typeof MetricNullHandlingSchema>;
export type MarketMetricDefinition = z.infer<typeof MarketMetricDefinitionSchema>;
export type MarketMetricDefinitions = z.infer<typeof MarketMetricDefinitionsSchema>;
export type PolicyDataset = z.infer<typeof PolicyDatasetSchema>;
export type PolicySensitivityTier = z.infer<typeof PolicySensitivityTierSchema>;
export type QueryGranularity = z.infer<typeof QueryGranularitySchema>;
export type ExportGranularity = z.infer<typeof ExportGranularitySchema>;
export type RedistributionPolicy = z.infer<typeof RedistributionPolicySchema>;
export type DatasetLicensingPolicy = z.infer<typeof DatasetLicensingPolicySchema>;
export type SpatialAnalysisPolicy = z.infer<typeof SpatialAnalysisPolicySchema>;
