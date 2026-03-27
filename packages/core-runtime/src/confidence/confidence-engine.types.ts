import type {
  ConfidenceLevel,
  ConfidenceVector,
  FreshnessState,
  TruthMode,
} from "@map-migration/http-contracts/confidence-http";

export type DependencyPrecisionTier = "A" | "B" | "C";

export interface DependencyRuntimeEffect {
  readonly accessStatus: string | null;
  readonly completenessObserved: number | null;
  readonly confidenceCap: ConfidenceLevel | null;
  readonly degradeTriggered: boolean;
  readonly downstreamObjectId: string;
  readonly downstreamObjectType: string;
  readonly effectiveFreshnessState: FreshnessState;
  readonly missingTriggered: boolean;
  readonly precisionTier: DependencyPrecisionTier;
  readonly requiredness: string;
  readonly roleInDownstream: string;
  readonly sourceAgeDays: number | null;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly stalenessState: FreshnessState | null;
  readonly suppressTriggered: boolean;
  readonly truthModeCap: TruthMode;
  readonly warnTriggered: boolean;
}

export interface AggregatedDependencyEvaluation {
  readonly agingRequiredSourceCount: number;
  readonly criticalRequiredSourceCount: number;
  readonly dependencyEffects: readonly DependencyRuntimeEffect[];
  readonly downstreamObjectId: string;
  readonly downstreamObjectType: string;
  readonly minimumConstitutiveConfidenceCap: ConfidenceLevel;
  readonly minimumTruthModeCap: TruthMode;
  readonly registryVersion: string | null;
  readonly requiredSourceCount: number;
  readonly staleRequiredSourceCount: number;
  readonly suppressibleMissingRequiredCount: number;
  readonly unavailableRequiredSourceCount: number;
  readonly worstRequiredFreshnessState: FreshnessState;
}

export interface LocalConfidenceOperatorResult {
  readonly compatibilityBadge: "high" | "medium" | "low";
  readonly confidence: ConfidenceVector;
  readonly suppressionReasons: readonly string[];
  readonly truthMode: TruthMode;
}

export interface ConfidenceTraceRecord {
  readonly confidence: ConfidenceVector;
  readonly dependencies: readonly DependencyRuntimeEffect[];
  readonly downstreamObjectId: string;
  readonly downstreamObjectType: string;
  readonly minimumConstitutiveConfidenceCap: ConfidenceLevel;
  readonly registryVersion: string | null;
  readonly truthMode: TruthMode;
  readonly worstRequiredFreshnessState: FreshnessState;
}

export interface CountyLocalOperatorInput {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly demandPressureAvailable: boolean;
  readonly hasLowConfidenceMapping: boolean;
  readonly isSeamCounty: boolean;
  readonly operatorZoneConfidence: ConfidenceLevel;
  readonly policyMappingConfidence: ConfidenceLevel;
  readonly rankStatus: "blocked" | "deferred" | "ranked";
}

export interface CatchmentLocalOperatorInput {
  readonly adjacencyAvailable: boolean;
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly neighborCount: number;
  readonly pointTouchWeightShare: number | null;
  readonly totalWeightMass: number | null;
}

export interface CorridorLocalOperatorInput {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly definingPrecisionTiers: readonly DependencyPrecisionTier[];
  readonly evidenceFamilies: readonly string[];
  readonly marketTreatment: "derived_market" | "validated_market";
  readonly routeDiversityScore: number | null;
  readonly stabilityState: "fail" | "not_run" | "pass";
  readonly validationState: "fail" | "not_run" | "pass";
}

export interface ParcelGateLocalOperatorInput {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly floodAvailable: boolean;
  readonly geometryAvailable: boolean;
  readonly protectedLandAvailable: boolean;
  readonly zoningAvailable: boolean;
}

export interface ParcelAccessLocalOperatorInput {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly corridorAccessAvailable: boolean;
  readonly corridorAccessConfidence: ConfidenceLevel;
}

export interface PacketSectionLocalOperatorInput {
  readonly confidence: ConfidenceVector;
  readonly truthMode: TruthMode;
  readonly truthModeCap: TruthMode;
  readonly upstreamConfidence: ConfidenceVector;
}

export interface PolicyPostureLocalOperatorInput {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly geographyBindingConfidence: ConfidenceLevel;
  readonly jurisdictionCoverageShare: number | null;
}
