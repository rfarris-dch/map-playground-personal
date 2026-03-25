/**
 * Analysis contracts barrel — re-exports from domain-specific modules.
 *
 * Previously this file mixed parcel scoring, proximity, market metrics,
 * and licensing/governance policy. Each domain now has its own file:
 *   - parcel-scoring-http.ts
 *   - market-metrics-http.ts
 *   - analysis-policy-http.ts
 */

export {
  ParcelScoreConstraintSchema,
  ParcelScoreComponentSchema,
  ScoredParcelSchema,
  ParcelScoreRequestSchema,
  ParcelScoreResponseSchema,
  ProximityTargetSchema,
  ProximityNeighborTypeSchema,
  ProximityRequestSchema,
  ProximityNeighborSchema,
  ProximityResponseSchema,
  AnalysisErrorResponseSchema,
  type ParcelScoreConstraint,
  type ParcelScoreComponent,
  type ScoredParcel,
  type ParcelScoreRequest,
  type ParcelScoreResponse,
  type ProximityTarget,
  type ProximityNeighborType,
  type ProximityRequest,
  type ProximityNeighbor,
  type ProximityResponse,
  type AnalysisErrorResponse,
} from "./parcel-scoring-http.js";

export {
  MarketMetricKeySchema,
  MetricTimeWindowSchema,
  MetricAggregationGrainSchema,
  MetricNullHandlingSchema,
  MarketMetricDefinitionSchema,
  MarketMetricDefinitionsSchema,
  type MarketMetricKey,
  type MetricTimeWindow,
  type MetricAggregationGrain,
  type MetricNullHandling,
  type MarketMetricDefinition,
  type MarketMetricDefinitions,
} from "./market-metrics-http.js";

export {
  PolicyDatasetSchema,
  PolicySensitivityTierSchema,
  QueryGranularitySchema,
  ExportGranularitySchema,
  RedistributionPolicySchema,
  DatasetLicensingPolicySchema,
  SpatialAnalysisPolicySchema,
  type PolicyDataset,
  type PolicySensitivityTier,
  type QueryGranularity,
  type ExportGranularity,
  type RedistributionPolicy,
  type DatasetLicensingPolicy,
  type SpatialAnalysisPolicy,
} from "./analysis-policy-http.js";
