import type { z } from "zod";
import type {
  AnalysisErrorResponseSchema,
  DatasetLicensingPolicySchema,
  ExportGranularitySchema,
  MarketMetricDefinitionSchema,
  MarketMetricDefinitionsSchema,
  MarketMetricKeySchema,
  MetricAggregationGrainSchema,
  MetricNullHandlingSchema,
  MetricTimeWindowSchema,
  ParcelScoreComponentSchema,
  ParcelScoreConstraintSchema,
  ParcelScoreRequestSchema,
  ParcelScoreResponseSchema,
  PolicyDatasetSchema,
  PolicySensitivityTierSchema,
  ProximityNeighborSchema,
  ProximityNeighborTypeSchema,
  ProximityRequestSchema,
  ProximityResponseSchema,
  ProximityTargetSchema,
  QueryGranularitySchema,
  RedistributionPolicySchema,
  ScoredParcelSchema,
  SpatialAnalysisPolicySchema,
} from "./analysis-contracts";

export type SpatialAnalysisPolicy = z.infer<typeof SpatialAnalysisPolicySchema>;

export type DatasetLicensingPolicy = z.infer<typeof DatasetLicensingPolicySchema>;

export type RedistributionPolicy = z.infer<typeof RedistributionPolicySchema>;

export type ExportGranularity = z.infer<typeof ExportGranularitySchema>;

export type QueryGranularity = z.infer<typeof QueryGranularitySchema>;

export type PolicySensitivityTier = z.infer<typeof PolicySensitivityTierSchema>;

export type PolicyDataset = z.infer<typeof PolicyDatasetSchema>;

export type MarketMetricDefinitions = z.infer<typeof MarketMetricDefinitionsSchema>;

export type MarketMetricDefinition = z.infer<typeof MarketMetricDefinitionSchema>;

export type MetricNullHandling = z.infer<typeof MetricNullHandlingSchema>;

export type MetricAggregationGrain = z.infer<typeof MetricAggregationGrainSchema>;

export type MetricTimeWindow = z.infer<typeof MetricTimeWindowSchema>;

export type MarketMetricKey = z.infer<typeof MarketMetricKeySchema>;

export type AnalysisErrorResponse = z.infer<typeof AnalysisErrorResponseSchema>;

export type ProximityResponse = z.infer<typeof ProximityResponseSchema>;

export type ProximityNeighbor = z.infer<typeof ProximityNeighborSchema>;

export type ProximityRequest = z.infer<typeof ProximityRequestSchema>;

export type ProximityNeighborType = z.infer<typeof ProximityNeighborTypeSchema>;

export type ProximityTarget = z.infer<typeof ProximityTargetSchema>;

export type ParcelScoreResponse = z.infer<typeof ParcelScoreResponseSchema>;

export type ParcelScoreRequest = z.infer<typeof ParcelScoreRequestSchema>;

export type ScoredParcel = z.infer<typeof ScoredParcelSchema>;

export type ParcelScoreComponent = z.infer<typeof ParcelScoreComponentSchema>;

export type ParcelScoreConstraint = z.infer<typeof ParcelScoreConstraintSchema>;
