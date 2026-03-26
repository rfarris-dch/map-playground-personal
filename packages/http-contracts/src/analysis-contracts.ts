/**
 * Analysis contracts barrel — re-exports from domain-specific modules.
 *
 * Previously this file mixed parcel scoring, proximity, market metrics,
 * and licensing/governance policy. Each domain now has its own file:
 *   - parcel-scoring-http.ts
 *   - market-metrics-http.ts
 *   - analysis-policy-http.ts
 */

// biome-ignore-all lint/performance/noBarrelFile: public package contract entrypoint is intentional.

export {
  type DatasetLicensingPolicy,
  DatasetLicensingPolicySchema,
  type ExportGranularity,
  ExportGranularitySchema,
  type PolicyDataset,
  PolicyDatasetSchema,
  type PolicySensitivityTier,
  PolicySensitivityTierSchema,
  type QueryGranularity,
  QueryGranularitySchema,
  type RedistributionPolicy,
  RedistributionPolicySchema,
  type SpatialAnalysisPolicy,
  SpatialAnalysisPolicySchema,
} from "./analysis-policy-http.js";

export {
  type MarketMetricDefinition,
  MarketMetricDefinitionSchema,
  type MarketMetricDefinitions,
  MarketMetricDefinitionsSchema,
  type MarketMetricKey,
  MarketMetricKeySchema,
  type MetricAggregationGrain,
  MetricAggregationGrainSchema,
  type MetricNullHandling,
  MetricNullHandlingSchema,
  type MetricTimeWindow,
  MetricTimeWindowSchema,
} from "./market-metrics-http.js";
export {
  type AnalysisErrorResponse,
  AnalysisErrorResponseSchema,
  type ParcelScoreComponent,
  ParcelScoreComponentSchema,
  type ParcelScoreConstraint,
  ParcelScoreConstraintSchema,
  type ParcelScoreRequest,
  ParcelScoreRequestSchema,
  type ParcelScoreResponse,
  ParcelScoreResponseSchema,
  type ProximityNeighbor,
  ProximityNeighborSchema,
  type ProximityNeighborType,
  ProximityNeighborTypeSchema,
  type ProximityRequest,
  ProximityRequestSchema,
  type ProximityResponse,
  ProximityResponseSchema,
  type ProximityTarget,
  ProximityTargetSchema,
  type ScoredParcel,
  ScoredParcelSchema,
} from "./parcel-scoring-http.js";
