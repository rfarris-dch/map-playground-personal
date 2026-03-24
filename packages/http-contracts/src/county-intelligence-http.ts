import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

function parseCountyIdsParam(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const countyIds = value
    .split(",")
    .map((countyId) => countyId.trim())
    .filter((countyId) => countyId.length > 0);

  return countyIds;
}

export const CountyFipsSchema = z.string().regex(/^[0-9]{5}$/);

export const CountyRankStatusSchema = z.enum(["ranked", "deferred", "blocked"]);
export const CountyAttractivenessTierSchema = z.enum([
  "advantaged",
  "balanced",
  "constrained",
  "blocked",
  "deferred",
]);
export const CountyConfidenceBadgeSchema = z.enum(["high", "medium", "low"]);
export const CountyValueStateSchema = z.enum([
  "observed",
  "derived",
  "estimated",
  "unknown",
  "restricted",
  "not_applicable",
]);
export const CountyDeferredReasonCodeSchema = z.enum([
  "MISSING_DEMAND_BASELINE",
  "MISSING_QUEUE_BASELINE",
  "MISSING_POLICY_BASELINE",
  "STALE_SOURCE",
  "LOW_CONFIDENCE_MAPPING",
  "RESTRICTED_CRITICAL_SOURCE",
]);
export const CountyDriverImpactSchema = z.enum(["tailwind", "headwind", "blocker", "context"]);
export const CountyChangeDirectionSchema = z.enum(["up", "down", "flat"]);
export const CountyMoratoriumStatusSchema = z.enum(["none", "watch", "active", "unknown"]);
export const CountySourceVolatilitySchema = z.enum(["low", "medium", "high", "unknown"]);
export const CountyMarketStructureSchema = z.enum([
  "organized_market",
  "traditional_vertical",
  "mixed",
  "unknown",
]);
export const CountyRetailChoiceStatusSchema = z.enum([
  "choice",
  "partial_choice",
  "bundled_monopoly",
  "mixed",
  "unknown",
]);
export const CountyCompetitiveAreaTypeSchema = z.enum([
  "choice",
  "noie",
  "bundled",
  "muni",
  "co_op",
  "mixed",
  "unknown",
]);

export const CountyDriverSchema = z.object({
  code: z.string().min(1),
  impact: CountyDriverImpactSchema,
  label: z.string().min(1),
  summary: z.string().min(1),
});

export const CountyChangeSchema = z.object({
  code: z.string().min(1),
  direction: CountyChangeDirectionSchema,
  label: z.string().min(1),
  magnitude: z.number().finite().nullable(),
  summary: z.string().min(1),
});

export const CountyPillarValueStatesSchema = z.object({
  demand: CountyValueStateSchema,
  gridFriction: CountyValueStateSchema,
  infrastructure: CountyValueStateSchema,
  policy: CountyValueStateSchema,
  supplyTimeline: CountyValueStateSchema,
});

export const CountyUtilityEntrySchema = z.object({
  utilityId: z.string().min(1).nullable(),
  utilityName: z.string().min(1).nullable(),
  territoryType: z.string().min(1).nullable(),
  retailChoiceStatus: CountyRetailChoiceStatusSchema,
});

export const CountyUtilityContextSchema = z.object({
  dominantUtilityId: z.string().min(1).nullable(),
  dominantUtilityName: z.string().min(1).nullable(),
  retailChoicePenetrationShare: z.number().min(0).max(1).nullable(),
  territoryType: z.string().min(1).nullable(),
  utilities: z.array(CountyUtilityEntrySchema),
  utilityCount: z.number().int().nonnegative().nullable(),
});

export const CountyConstraintSummarySchema = z.object({
  constraintId: z.string().min(1),
  flowMw: z.number().finite().nullable(),
  hoursBound: z.number().finite().nullable(),
  label: z.string().min(1),
  limitMw: z.number().finite().nullable(),
  operator: z.string().min(1).nullable(),
  shadowPrice: z.number().finite().nullable(),
  voltageKv: z.number().finite().nullable(),
});

export const CountyPowerMarketContextSchema = z.object({
  balancingAuthority: z.string().min(1).nullable(),
  loadZone: z.string().min(1).nullable(),
  marketStructure: CountyMarketStructureSchema,
  meteoZone: z.string().min(1).nullable(),
  operatorWeatherZone: z.string().min(1).nullable(),
  operatorZoneConfidence: CountyConfidenceBadgeSchema.nullable(),
  operatorZoneLabel: z.string().min(1).nullable(),
  operatorZoneType: z.string().min(1).nullable(),
  weatherZone: z.string().min(1).nullable(),
  wholesaleOperator: z.string().min(1).nullable(),
});

export const CountyRetailStructureSchema = z.object({
  competitiveAreaType: CountyCompetitiveAreaTypeSchema,
  primaryTduOrUtility: z.string().min(1).nullable(),
  retailChoiceStatus: CountyRetailChoiceStatusSchema,
  utilityContext: CountyUtilityContextSchema,
});

export const CountyTransmissionContextSchema = z.object({
  miles138kvPlus: z.number().finite().nullable(),
  miles230kvPlus: z.number().finite().nullable(),
  miles345kvPlus: z.number().finite().nullable(),
  miles500kvPlus: z.number().finite().nullable(),
  miles69kvPlus: z.number().finite().nullable(),
  miles765kvPlus: z.number().finite().nullable(),
});

export const CountyInterconnectionQueueContextSchema = z.object({
  activeMw: z.number().finite().nullable(),
  avgAgeDays: z.number().finite().nullable(),
  medianDaysInQueueActive: z.number().finite().nullable(),
  projectCountActive: z.number().int().nonnegative().nullable(),
  recentOnlineMw: z.number().finite().nullable(),
  solarMw: z.number().finite().nullable(),
  storageMw: z.number().finite().nullable(),
  windMw: z.number().finite().nullable(),
  withdrawalRate: z.number().min(0).max(1).nullable(),
});

export const CountyCongestionContextSchema = z.object({
  avgRtCongestionComponent: z.number().finite().nullable(),
  congestionProxyScore: z.number().finite().nullable(),
  negativePriceHourShare: z.number().min(0).max(1).nullable(),
  p95ShadowPrice: z.number().finite().nullable(),
  topConstraints: z.array(CountyConstraintSummarySchema),
});

export const CountySourceProvenanceSchema = z.object({
  congestion: z.string().min(1).nullable(),
  interconnectionQueue: z.string().min(1).nullable(),
  operatingFootprints: z.string().min(1).nullable(),
  retailStructure: z.string().min(1).nullable(),
  transmission: z.string().min(1).nullable(),
  utilityTerritories: z.string().min(1).nullable(),
  wholesaleMarkets: z.string().min(1).nullable(),
});

export const CountyScoreFeatureCoverageSchema = z.object({
  congestion: z.boolean(),
  demand: z.boolean(),
  gridFriction: z.boolean(),
  history: z.boolean(),
  infrastructure: z.boolean(),
  interconnectionQueue: z.boolean(),
  marketSeams: z.boolean(),
  narratives: z.boolean(),
  operatingFootprints: z.boolean(),
  policy: z.boolean(),
  retailStructure: z.boolean(),
  supplyTimeline: z.boolean(),
  transmission: z.boolean(),
  utilityTerritories: z.boolean(),
  wholesaleMarkets: z.boolean(),
});

export const CountyScoreSchema = z.object({
  countyFips: CountyFipsSchema,
  countyName: z.string().min(1).nullable(),
  stateAbbrev: z.string().length(2).nullable(),
  rankStatus: CountyRankStatusSchema,
  attractivenessTier: CountyAttractivenessTierSchema,
  confidenceBadge: CountyConfidenceBadgeSchema,
  marketPressureIndex: z.number().finite().nullable(),
  demandPressureScore: z.number().finite().nullable(),
  supplyTimelineScore: z.number().finite().nullable(),
  gridFrictionScore: z.number().finite().nullable(),
  policyConstraintScore: z.number().finite().nullable(),
  freshnessScore: z.number().finite().nullable(),
  lastUpdatedAt: z.string().datetime().nullable(),
  sourceVolatility: CountySourceVolatilitySchema,
  narrativeSummary: z.string().min(1).nullable(),
  topDrivers: z.array(CountyDriverSchema),
  deferredReasonCodes: z.array(CountyDeferredReasonCodeSchema),
  whatChanged30d: z.array(CountyChangeSchema),
  whatChanged60d: z.array(CountyChangeSchema),
  whatChanged90d: z.array(CountyChangeSchema),
  pillarValueStates: CountyPillarValueStatesSchema,
  powerMarketContext: CountyPowerMarketContextSchema,
  retailStructure: CountyRetailStructureSchema,
  expectedMw0To24m: z.number().finite().nullable(),
  expectedMw24To60m: z.number().finite().nullable(),
  recentCommissionedMw24m: z.number().finite().nullable(),
  demandMomentumQoq: z.number().finite().nullable(),
  providerEntryCount12m: z.number().int().nonnegative().nullable(),
  expectedSupplyMw0To36m: z.number().finite().nullable(),
  expectedSupplyMw36To60m: z.number().finite().nullable(),
  signedIaMw: z.number().finite().nullable(),
  queueMwActive: z.number().finite().nullable(),
  queueProjectCountActive: z.number().int().nonnegative().nullable(),
  medianDaysInQueueActive: z.number().finite().nullable(),
  pastDueShare: z.number().min(0).max(1).nullable(),
  marketWithdrawalPrior: z.number().min(0).max(1).nullable(),
  congestionProxyScore: z.number().finite().nullable(),
  plannedUpgradeCount: z.number().int().nonnegative().nullable(),
  heatmapSignalFlag: z.boolean().nullable(),
  policyMomentumScore: z.number().finite().nullable(),
  moratoriumStatus: CountyMoratoriumStatusSchema,
  publicSentimentScore: z.number().finite().nullable(),
  policyEventCount: z.number().int().nonnegative().nullable(),
  countyTaggedEventShare: z.number().min(0).max(1).nullable(),
  policyMappingConfidence: CountyConfidenceBadgeSchema.nullable(),
  transmissionMiles69kvPlus: z.number().finite().nullable(),
  transmissionMiles138kvPlus: z.number().finite().nullable(),
  transmissionMiles230kvPlus: z.number().finite().nullable(),
  transmissionMiles345kvPlus: z.number().finite().nullable(),
  transmissionMiles500kvPlus: z.number().finite().nullable(),
  transmissionMiles765kvPlus: z.number().finite().nullable(),
  transmissionContext: CountyTransmissionContextSchema,
  gasPipelinePresenceFlag: z.boolean().nullable(),
  gasPipelineMileageCounty: z.number().finite().nullable(),
  fiberPresenceFlag: z.boolean().nullable(),
  primaryMarketId: z.string().min(1).nullable(),
  isBorderCounty: z.boolean(),
  isSeamCounty: z.boolean(),
  queueStorageMw: z.number().finite().nullable(),
  queueSolarMw: z.number().finite().nullable(),
  queueWindMw: z.number().finite().nullable(),
  queueAvgAgeDays: z.number().finite().nullable(),
  queueWithdrawalRate: z.number().min(0).max(1).nullable(),
  recentOnlineMw: z.number().finite().nullable(),
  avgRtCongestionComponent: z.number().finite().nullable(),
  p95ShadowPrice: z.number().finite().nullable(),
  negativePriceHourShare: z.number().min(0).max(1).nullable(),
  topConstraints: z.array(CountyConstraintSummarySchema),
  interconnectionQueue: CountyInterconnectionQueueContextSchema,
  congestionContext: CountyCongestionContextSchema,
  sourceProvenance: CountySourceProvenanceSchema,
  publicationRunId: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1).nullable(),
  inputDataVersion: z.string().min(1).nullable(),
});

export const CountyScoresSummarySchema = z.object({
  requestedCountyIds: z.array(CountyFipsSchema),
  missingCountyIds: z.array(CountyFipsSchema),
  deferredCountyIds: z.array(CountyFipsSchema),
  blockedCountyIds: z.array(CountyFipsSchema),
});

export const CountyScoresRequestSchema = z.object({
  countyIds: z.preprocess(parseCountyIdsParam, z.array(CountyFipsSchema).min(1).max(500)),
});

export const CountyScoresDebugRequestSchema = z.object({
  countyIds: z.preprocess(parseCountyIdsParam, z.array(CountyFipsSchema).min(1).max(50)),
});

export const CountyScoresResponseSchema = z.object({
  rows: z.array(CountyScoreSchema),
  summary: CountyScoresSummarySchema,
  meta: ResponseMetaSchema,
});

export const CountyScoresStatusResponseSchema = z.object({
  datasetAvailable: z.boolean(),
  publicationRunId: z.string().min(1).nullable(),
  publishedAt: z.string().datetime().nullable(),
  methodologyId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  inputDataVersion: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1).nullable(),
  rowCount: z.number().int().nonnegative(),
  sourceCountyCount: z.number().int().nonnegative(),
  rankedCountyCount: z.number().int().nonnegative(),
  deferredCountyCount: z.number().int().nonnegative(),
  blockedCountyCount: z.number().int().nonnegative(),
  highConfidenceCount: z.number().int().nonnegative(),
  mediumConfidenceCount: z.number().int().nonnegative(),
  lowConfidenceCount: z.number().int().nonnegative(),
  freshCountyCount: z.number().int().nonnegative(),
  availableFeatureFamilies: z.array(z.string().min(1)),
  missingFeatureFamilies: z.array(z.string().min(1)),
  featureCoverage: CountyScoreFeatureCoverageSchema,
  meta: ResponseMetaSchema,
});

export const CountyScoresCoverageFieldSchema = z.object({
  fieldName: z.string().min(1),
  populatedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
});

export const CountyScoresCoverageByOperatorSchema = z.object({
  avgRtCongestionComponentCount: z.number().int().nonnegative(),
  countyCount: z.number().int().nonnegative(),
  meteoZoneCount: z.number().int().nonnegative(),
  operatorWeatherZoneCount: z.number().int().nonnegative(),
  operatorZoneLabelCount: z.number().int().nonnegative(),
  p95ShadowPriceCount: z.number().int().nonnegative(),
  primaryTduOrUtilityCount: z.number().int().nonnegative(),
  wholesaleOperator: z.string().min(1),
});

export const CountyScoresCoverageResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  rowCount: z.number().int().nonnegative(),
  fields: z.array(CountyScoresCoverageFieldSchema),
  byWholesaleOperator: z.array(CountyScoresCoverageByOperatorSchema),
  meta: ResponseMetaSchema,
});

export const CountyScoresResolutionSourceSchema = z.object({
  sourceSystem: z.string().min(1),
  totalProjects: z.number().int().nonnegative(),
  unresolvedProjects: z.number().int().nonnegative(),
  totalSnapshots: z.number().int().nonnegative(),
  unresolvedSnapshots: z.number().int().nonnegative(),
  directResolutionCount: z.number().int().nonnegative(),
  derivedResolutionCount: z.number().int().nonnegative(),
  manualResolutionCount: z.number().int().nonnegative(),
  lowConfidenceResolutionCount: z.number().int().nonnegative(),
  samplePoiLabels: z.array(z.string().min(1)),
  sampleLocationLabels: z.array(z.string().min(1)),
  sampleSnapshotPoiLabels: z.array(z.string().min(1)),
  sampleSnapshotLocationLabels: z.array(z.string().min(1)),
});

export const CountyScoresResolutionResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  effectiveDate: z.string().date().nullable(),
  unresolvedProjectCount: z.number().int().nonnegative(),
  unresolvedSnapshotCount: z.number().int().nonnegative(),
  bySource: z.array(CountyScoresResolutionSourceSchema),
  meta: ResponseMetaSchema,
});

export const CountyOperatorZoneDebugSchema = z.object({
  allocationShare: z.number().min(0).max(1),
  operatorZoneConfidence: CountyConfidenceBadgeSchema.nullable(),
  operatorZoneLabel: z.string().min(1),
  operatorZoneType: z.string().min(1),
  resolutionMethod: z.string().min(1),
  sourceAsOfDate: z.string().date().nullable(),
  wholesaleOperator: z.string().min(1),
});

export const CountyQueueResolutionDebugSchema = z.object({
  allocationShare: z.number().min(0).max(1),
  countyFips: CountyFipsSchema,
  projectId: z.string().min(1),
  queuePoiLabel: z.string().min(1).nullable(),
  resolverConfidence: z.string().min(1),
  resolverType: z.string().min(1),
  sourceLocationLabel: z.string().min(1).nullable(),
  sourceSystem: z.string().min(1),
  stateAbbrev: z.string().length(2).nullable(),
});

export const CountyQueuePoiReferenceDebugSchema = z.object({
  countyFips: CountyFipsSchema,
  operatorZoneLabel: z.string().min(1).nullable(),
  operatorZoneType: z.string().min(1).nullable(),
  queuePoiLabel: z.string().min(1),
  resolutionMethod: z.string().min(1),
  resolverConfidence: z.string().min(1),
  sourceAsOfDate: z.string().date().nullable(),
  sourceSystem: z.string().min(1),
  stateAbbrev: z.string().length(2).nullable(),
});

export const CountyCongestionSnapshotDebugSchema = z.object({
  avgRtCongestionComponent: z.number().finite().nullable(),
  negativePriceHourShare: z.number().min(0).max(1).nullable(),
  p95ShadowPrice: z.number().finite().nullable(),
  sourceAsOfDate: z.string().date().nullable(),
});

export const CountyScoresDebugCountySchema = z.object({
  congestionSnapshot: CountyCongestionSnapshotDebugSchema.nullable(),
  countyFips: CountyFipsSchema,
  operatorZones: z.array(CountyOperatorZoneDebugSchema),
  queuePoiReferences: z.array(CountyQueuePoiReferenceDebugSchema),
  queueResolutions: z.array(CountyQueueResolutionDebugSchema),
  score: CountyScoreSchema.nullable(),
});

export const CountyScoresDebugResponseSchema = z.object({
  publicationRunId: z.string().min(1).nullable(),
  dataVersion: z.string().min(1).nullable(),
  counties: z.array(CountyScoresDebugCountySchema),
  meta: ResponseMetaSchema,
});

export type CountyScore = z.infer<typeof CountyScoreSchema>;
export type CountyDriver = z.infer<typeof CountyDriverSchema>;
export type CountyChange = z.infer<typeof CountyChangeSchema>;
export type CountyPillarValueStates = z.infer<typeof CountyPillarValueStatesSchema>;
export type CountyDeferredReasonCode = z.infer<typeof CountyDeferredReasonCodeSchema>;
export type CountyUtilityEntry = z.infer<typeof CountyUtilityEntrySchema>;
export type CountyUtilityContext = z.infer<typeof CountyUtilityContextSchema>;
export type CountyConstraintSummary = z.infer<typeof CountyConstraintSummarySchema>;
export type CountyPowerMarketContext = z.infer<typeof CountyPowerMarketContextSchema>;
export type CountyRetailStructure = z.infer<typeof CountyRetailStructureSchema>;
export type CountyTransmissionContext = z.infer<typeof CountyTransmissionContextSchema>;
export type CountyInterconnectionQueueContext = z.infer<
  typeof CountyInterconnectionQueueContextSchema
>;
export type CountyCongestionContext = z.infer<typeof CountyCongestionContextSchema>;
export type CountySourceProvenance = z.infer<typeof CountySourceProvenanceSchema>;
export type CountyScoresRequest = z.infer<typeof CountyScoresRequestSchema>;
export type CountyScoresDebugRequest = z.infer<typeof CountyScoresDebugRequestSchema>;
export type CountyScoresSummary = z.infer<typeof CountyScoresSummarySchema>;
export type CountyScoresResponse = z.infer<typeof CountyScoresResponseSchema>;
export type CountyScoresStatusResponse = z.infer<typeof CountyScoresStatusResponseSchema>;
export type CountyScoresCoverageField = z.infer<typeof CountyScoresCoverageFieldSchema>;
export type CountyScoresCoverageByOperator = z.infer<typeof CountyScoresCoverageByOperatorSchema>;
export type CountyScoresCoverageResponse = z.infer<typeof CountyScoresCoverageResponseSchema>;
export type CountyScoresResolutionSource = z.infer<typeof CountyScoresResolutionSourceSchema>;
export type CountyScoresResolutionResponse = z.infer<typeof CountyScoresResolutionResponseSchema>;
export type CountyOperatorZoneDebug = z.infer<typeof CountyOperatorZoneDebugSchema>;
export type CountyQueueResolutionDebug = z.infer<typeof CountyQueueResolutionDebugSchema>;
export type CountyQueuePoiReferenceDebug = z.infer<typeof CountyQueuePoiReferenceDebugSchema>;
export type CountyCongestionSnapshotDebug = z.infer<typeof CountyCongestionSnapshotDebugSchema>;
export type CountyScoresDebugCounty = z.infer<typeof CountyScoresDebugCountySchema>;
export type CountyScoresDebugResponse = z.infer<typeof CountyScoresDebugResponseSchema>;
