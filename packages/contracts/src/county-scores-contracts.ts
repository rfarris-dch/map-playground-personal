import { z } from "zod";
import { ResponseMetaSchema } from "./shared-contracts";

const CountyFipsSchema = z.string().regex(/^[0-9]{5}$/);

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

export const CountyScoreFeatureCoverageSchema = z.object({
  demand: z.boolean(),
  gridFriction: z.boolean(),
  history: z.boolean(),
  infrastructure: z.boolean(),
  marketSeams: z.boolean(),
  narratives: z.boolean(),
  policy: z.boolean(),
  supplyTimeline: z.boolean(),
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
  transmissionMiles230kvPlus: z.number().finite().nullable(),
  gasPipelinePresenceFlag: z.boolean().nullable(),
  gasPipelineMileageCounty: z.number().finite().nullable(),
  fiberPresenceFlag: z.boolean().nullable(),
  waterStressScore: z.number().finite().nullable(),
  primaryMarketId: z.string().min(1).nullable(),
  isSeamCounty: z.boolean(),
  formulaVersion: z.string().min(1).nullable(),
  inputDataVersion: z.string().min(1).nullable(),
});

export const CountyScoresSummarySchema = z.object({
  requestedCountyIds: z.array(CountyFipsSchema),
  missingCountyIds: z.array(CountyFipsSchema),
  deferredCountyIds: z.array(CountyFipsSchema),
  blockedCountyIds: z.array(CountyFipsSchema),
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

export type CountyScore = z.infer<typeof CountyScoreSchema>;
export type CountyDriver = z.infer<typeof CountyDriverSchema>;
export type CountyChange = z.infer<typeof CountyChangeSchema>;
export type CountyPillarValueStates = z.infer<typeof CountyPillarValueStatesSchema>;
export type CountyDeferredReasonCode = z.infer<typeof CountyDeferredReasonCodeSchema>;
export type CountyScoresSummary = z.infer<typeof CountyScoresSummarySchema>;
export type CountyScoresResponse = z.infer<typeof CountyScoresResponseSchema>;
export type CountyScoresStatusResponse = z.infer<typeof CountyScoresStatusResponseSchema>;
