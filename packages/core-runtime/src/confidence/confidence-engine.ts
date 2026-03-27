import {
  capConfidenceLevel,
  capTruthMode,
  deriveCompatibilityConfidenceBadge,
  deriveExternalPacketSuppressionState,
  mergeMostRestrictiveSuppressionState,
  mergeWorstFreshnessState,
} from "@map-migration/http-contracts/confidence-http";
import { CATCHMENT_POINT_TOUCH_DOMINANCE_THRESHOLD } from "./catchment-calibration";
import type {
  AggregatedDependencyEvaluation,
  CatchmentLocalOperatorInput,
  ConfidenceTraceRecord,
  CorridorLocalOperatorInput,
  CountyLocalOperatorInput,
  DependencyRuntimeEffect,
  LocalConfidenceOperatorResult,
  PacketSectionLocalOperatorInput,
  ParcelAccessLocalOperatorInput,
  ParcelGateLocalOperatorInput,
  PolicyPostureLocalOperatorInput,
} from "./confidence-engine.types";

export type {
  AggregatedDependencyEvaluation,
  CatchmentLocalOperatorInput,
  ConfidenceTraceRecord,
  CorridorLocalOperatorInput,
  CountyLocalOperatorInput,
  DependencyRuntimeEffect,
  LocalConfidenceOperatorResult,
  PacketSectionLocalOperatorInput,
  ParcelAccessLocalOperatorInput,
  ParcelGateLocalOperatorInput,
  PolicyPostureLocalOperatorInput,
} from "./confidence-engine.types";

function confidenceRank(value: NonNullable<DependencyRuntimeEffect["confidenceCap"]>): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "unknown":
      return 0;
    default:
      return 0;
  }
}

function truthModeRank(value: DependencyRuntimeEffect["truthModeCap"]): number {
  switch (value) {
    case "full":
      return 5;
    case "validated_screening":
      return 4;
    case "derived_screening":
      return 3;
    case "context_only":
      return 2;
    case "internal_only":
      return 1;
    default:
      return 1;
  }
}

function pickMinimumConfidenceCap(
  effects: readonly DependencyRuntimeEffect[]
): AggregatedDependencyEvaluation["minimumConstitutiveConfidenceCap"] {
  let selected: AggregatedDependencyEvaluation["minimumConstitutiveConfidenceCap"] = "unknown";
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const effect of effects) {
    const confidenceCap = effect.confidenceCap;
    if (confidenceCap === null) {
      continue;
    }

    const rank = confidenceRank(confidenceCap);
    if (rank < selectedRank) {
      selected = confidenceCap;
      selectedRank = rank;
    }
  }

  return selected;
}

function pickMinimumTruthModeCap(
  effects: readonly DependencyRuntimeEffect[]
): AggregatedDependencyEvaluation["minimumTruthModeCap"] {
  let selected: AggregatedDependencyEvaluation["minimumTruthModeCap"] = "internal_only";
  let selectedRank = Number.POSITIVE_INFINITY;

  for (const effect of effects) {
    const rank = truthModeRank(effect.truthModeCap);
    if (rank < selectedRank) {
      selected = effect.truthModeCap;
      selectedRank = rank;
    }
  }

  return selected;
}

function isAccessible(accessStatus: DependencyRuntimeEffect["accessStatus"]): boolean {
  return accessStatus === "accessible";
}

function isConstitutive(effect: DependencyRuntimeEffect): boolean {
  return effect.roleInDownstream !== "contextual";
}

function isRequired(effect: DependencyRuntimeEffect): boolean {
  return effect.requiredness === "required";
}

function hasMediumMethodInput(input: CountyLocalOperatorInput): boolean {
  return input.operatorZoneConfidence === "medium" || input.policyMappingConfidence === "medium";
}

function hasHighMethodInput(input: CountyLocalOperatorInput): boolean {
  return input.operatorZoneConfidence === "high" || input.policyMappingConfidence === "high";
}

function corridorDefinesWithTierC(input: CorridorLocalOperatorInput): boolean {
  return input.definingPrecisionTiers.includes("C");
}

function corridorDefinesWithOnlyTierB(input: CorridorLocalOperatorInput): boolean {
  return (
    input.definingPrecisionTiers.length >= 2 &&
    input.definingPrecisionTiers.every((tier) => tier === "B")
  );
}

function hasEvidenceFamily(input: CorridorLocalOperatorInput, family: string): boolean {
  return input.evidenceFamilies.includes(family);
}

function deriveCorridorMethodConfidence(
  input: CorridorLocalOperatorInput
): LocalConfidenceOperatorResult["confidence"]["methodConfidence"] {
  if (input.stabilityState !== "pass") {
    return "low";
  }

  if (input.marketTreatment === "validated_market" && input.validationState === "pass") {
    if (input.routeDiversityScore !== null && input.routeDiversityScore < 0.5) {
      return "medium";
    }

    return "high";
  }

  if (input.routeDiversityScore !== null && input.routeDiversityScore >= 0.5) {
    return "medium";
  }

  return "low";
}

function deriveCorridorCoverageConfidence(
  input: CorridorLocalOperatorInput
): LocalConfidenceOperatorResult["confidence"]["coverageConfidence"] {
  const hasTransmission = hasEvidenceFamily(input, "transmission");
  const hasFiber = hasEvidenceFamily(input, "fiber");

  if (hasTransmission && hasFiber) {
    return "high";
  }

  if (hasTransmission || hasFiber) {
    return "medium";
  }

  return "low";
}

function deriveCorridorSuppressionState(
  input: CorridorLocalOperatorInput,
  baselineSuppression: LocalConfidenceOperatorResult["confidence"]["suppressionState"]
): LocalConfidenceOperatorResult["confidence"]["suppressionState"] {
  return mergeMostRestrictiveSuppressionState([
    baselineSuppression,
    input.stabilityState === "pass" ? "none" : "suppressed",
    corridorDefinesWithTierC(input) ? "suppressed" : "none",
    input.marketTreatment === "derived_market" ? "downgraded" : "none",
  ]);
}

function deriveParcelGateEvidenceConfidence(
  input: ParcelGateLocalOperatorInput,
  missingHardGateData: boolean
): LocalConfidenceOperatorResult["confidence"]["evidenceConfidence"] {
  if (!input.geometryAvailable) {
    return "low";
  }

  if (missingHardGateData) {
    return "medium";
  }

  return input.aggregated.minimumConstitutiveConfidenceCap;
}

function deriveParcelGateCoverageConfidence(
  input: ParcelGateLocalOperatorInput,
  missingHardGateData: boolean
): LocalConfidenceOperatorResult["confidence"]["coverageConfidence"] {
  if (missingHardGateData) {
    return "low";
  }

  return input.protectedLandAvailable ? "high" : "medium";
}

function derivePolicyCoverageConfidence(
  input: PolicyPostureLocalOperatorInput
): LocalConfidenceOperatorResult["confidence"]["coverageConfidence"] {
  if (input.jurisdictionCoverageShare === null) {
    return "unknown";
  }

  if (input.jurisdictionCoverageShare >= 0.9) {
    return "high";
  }

  if (input.jurisdictionCoverageShare >= 0.6) {
    return "medium";
  }

  return "low";
}

export function deriveBaselineSuppressionState(
  aggregated: AggregatedDependencyEvaluation
): LocalConfidenceOperatorResult["confidence"]["suppressionState"] {
  if (
    aggregated.suppressibleMissingRequiredCount > 0 ||
    aggregated.unavailableRequiredSourceCount > 0 ||
    aggregated.criticalRequiredSourceCount > 0
  ) {
    return "review_required";
  }

  if (aggregated.staleRequiredSourceCount > 0 || aggregated.agingRequiredSourceCount > 0) {
    return "downgraded";
  }

  return "none";
}

export function aggregateDependencyEffects(
  registryVersion: string | null,
  effects: readonly DependencyRuntimeEffect[]
): AggregatedDependencyEvaluation {
  const constitutiveEffects = effects.filter(isConstitutive);
  const requiredEffects = constitutiveEffects.filter(isRequired);
  const sharedObject = constitutiveEffects[0] ?? effects[0];

  return {
    agingRequiredSourceCount: requiredEffects.filter(
      (effect) => effect.effectiveFreshnessState === "aging"
    ).length,
    criticalRequiredSourceCount: requiredEffects.filter(
      (effect) => effect.effectiveFreshnessState === "critical"
    ).length,
    dependencyEffects: effects,
    downstreamObjectId: sharedObject?.downstreamObjectId ?? "unknown",
    downstreamObjectType: sharedObject?.downstreamObjectType ?? "unknown",
    minimumConstitutiveConfidenceCap: pickMinimumConfidenceCap(constitutiveEffects),
    minimumTruthModeCap: pickMinimumTruthModeCap(constitutiveEffects),
    registryVersion,
    requiredSourceCount: requiredEffects.length,
    staleRequiredSourceCount: requiredEffects.filter(
      (effect) => effect.effectiveFreshnessState === "stale"
    ).length,
    suppressibleMissingRequiredCount: requiredEffects.filter((effect) => effect.missingTriggered)
      .length,
    unavailableRequiredSourceCount: requiredEffects.filter(
      (effect) => !isAccessible(effect.accessStatus)
    ).length,
    worstRequiredFreshnessState:
      requiredEffects.length === 0
        ? "unknown"
        : mergeWorstFreshnessState(requiredEffects.map((effect) => effect.effectiveFreshnessState)),
  };
}

export function buildConfidenceTraceRecord(args: {
  readonly aggregated: AggregatedDependencyEvaluation;
  readonly confidence: LocalConfidenceOperatorResult["confidence"];
  readonly truthMode: LocalConfidenceOperatorResult["truthMode"];
}): ConfidenceTraceRecord {
  return {
    confidence: args.confidence,
    dependencies: args.aggregated.dependencyEffects,
    downstreamObjectId: args.aggregated.downstreamObjectId,
    downstreamObjectType: args.aggregated.downstreamObjectType,
    minimumConstitutiveConfidenceCap: args.aggregated.minimumConstitutiveConfidenceCap,
    registryVersion: args.aggregated.registryVersion,
    truthMode: args.truthMode,
    worstRequiredFreshnessState: args.aggregated.worstRequiredFreshnessState,
  };
}

export function deriveCountyLocalOperatorResult(
  input: CountyLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);
  const evidenceConfidence = input.demandPressureAvailable
    ? input.aggregated.minimumConstitutiveConfidenceCap
    : "low";

  let methodConfidence: LocalConfidenceOperatorResult["confidence"]["methodConfidence"] = "unknown";

  if (input.hasLowConfidenceMapping || (input.isSeamCounty && input.hasLowConfidenceMapping)) {
    methodConfidence = "low";
  } else if (hasMediumMethodInput(input)) {
    methodConfidence = "medium";
  } else if (hasHighMethodInput(input)) {
    methodConfidence = "high";
  } else if (input.aggregated.minimumConstitutiveConfidenceCap !== "unknown") {
    methodConfidence = "medium";
  }

  let coverageConfidence: LocalConfidenceOperatorResult["confidence"]["coverageConfidence"] =
    "high";
  if (!input.demandPressureAvailable) {
    coverageConfidence = "low";
  } else if (input.hasLowConfidenceMapping) {
    coverageConfidence = "medium";
  }

  const cappedConfidence = {
    evidenceConfidence,
    methodConfidence: capConfidenceLevel(
      methodConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState: mergeMostRestrictiveSuppressionState([
      baselineSuppression,
      input.rankStatus === "deferred" || input.hasLowConfidenceMapping ? "downgraded" : "none",
    ]),
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(cappedConfidence),
    confidence: {
      ...cappedConfidence,
      evidenceConfidence: capConfidenceLevel(
        cappedConfidence.evidenceConfidence,
        input.aggregated.minimumConstitutiveConfidenceCap
      ),
    },
    suppressionReasons: [
      ...(input.aggregated.unavailableRequiredSourceCount > 0
        ? ["required_source_unavailable"]
        : []),
      ...(input.aggregated.criticalRequiredSourceCount > 0 ? ["required_source_critical"] : []),
      ...(input.aggregated.staleRequiredSourceCount > 0 ? ["required_source_stale"] : []),
      ...(input.rankStatus === "deferred" ? ["county_rank_deferred"] : []),
      ...(input.hasLowConfidenceMapping ? ["low_confidence_mapping"] : []),
    ],
    truthMode: capTruthMode("full", input.aggregated.minimumTruthModeCap),
  };
}

export function deriveCatchmentLocalOperatorResult(
  input: CatchmentLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);

  let methodConfidence: LocalConfidenceOperatorResult["confidence"]["methodConfidence"] = "high";
  if (input.totalWeightMass === null || input.totalWeightMass <= 0 || input.neighborCount === 0) {
    methodConfidence = "low";
  } else if (
    input.pointTouchWeightShare !== null &&
    input.pointTouchWeightShare > CATCHMENT_POINT_TOUCH_DOMINANCE_THRESHOLD
  ) {
    methodConfidence = "medium";
  }

  let coverageConfidence: LocalConfidenceOperatorResult["confidence"]["coverageConfidence"] =
    "high";
  if (input.totalWeightMass === null || input.totalWeightMass <= 0) {
    coverageConfidence = "low";
  } else if (
    input.pointTouchWeightShare !== null &&
    input.pointTouchWeightShare > CATCHMENT_POINT_TOUCH_DOMINANCE_THRESHOLD
  ) {
    coverageConfidence = "medium";
  }

  const confidence = {
    evidenceConfidence: capConfidenceLevel(
      input.adjacencyAvailable ? input.aggregated.minimumConstitutiveConfidenceCap : "low",
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    methodConfidence: capConfidenceLevel(
      methodConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState: mergeMostRestrictiveSuppressionState([
      baselineSuppression,
      input.adjacencyAvailable ? "none" : "review_required",
    ]),
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: [
      ...(input.adjacencyAvailable ? [] : ["county_adjacency_unavailable"]),
      ...(input.pointTouchWeightShare !== null &&
      input.pointTouchWeightShare > CATCHMENT_POINT_TOUCH_DOMINANCE_THRESHOLD
        ? ["point_touch_dominant"]
        : []),
    ],
    truthMode: capTruthMode("full", input.aggregated.minimumTruthModeCap),
  };
}

export function deriveCorridorLocalOperatorResult(
  input: CorridorLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);
  const definesWithTierC = corridorDefinesWithTierC(input);
  const definesWithOnlyTierB = corridorDefinesWithOnlyTierB(input);

  let evidenceConfidence = input.aggregated.minimumConstitutiveConfidenceCap;
  if (definesWithOnlyTierB) {
    evidenceConfidence = capConfidenceLevel(evidenceConfidence, "medium");
  }

  const methodConfidence = deriveCorridorMethodConfidence(input);
  const coverageConfidence = deriveCorridorCoverageConfidence(input);

  const truthMode = capTruthMode(
    input.marketTreatment === "validated_market" ? "validated_screening" : "derived_screening",
    input.aggregated.minimumTruthModeCap
  );

  const suppressionState = deriveCorridorSuppressionState(input, baselineSuppression);

  const confidence = {
    evidenceConfidence,
    methodConfidence: capConfidenceLevel(
      methodConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState,
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: [
      ...(definesWithOnlyTierB ? ["tier_b_pair_cap"] : []),
      ...(definesWithTierC ? ["tier_c_defining_source"] : []),
      ...(input.stabilityState === "pass" ? [] : ["stability_gate_failed"]),
      ...(input.marketTreatment === "derived_market" ? ["derived_market_treatment"] : []),
    ],
    truthMode,
  };
}

export function deriveParcelGateLocalOperatorResult(
  input: ParcelGateLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);
  const missingHardGateData = !(input.zoningAvailable && input.floodAvailable);
  const evidenceConfidence = deriveParcelGateEvidenceConfidence(input, missingHardGateData);
  const methodConfidence = input.geometryAvailable ? "high" : "low";
  const coverageConfidence = deriveParcelGateCoverageConfidence(input, missingHardGateData);

  const confidence = {
    evidenceConfidence: capConfidenceLevel(
      evidenceConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    methodConfidence: capConfidenceLevel(
      methodConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState: mergeMostRestrictiveSuppressionState([
      baselineSuppression,
      missingHardGateData ? "review_required" : "none",
    ]),
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: [
      ...(input.geometryAvailable ? [] : ["parcel_geometry_missing"]),
      ...(input.zoningAvailable ? [] : ["parcel_zoning_missing"]),
      ...(input.floodAvailable ? [] : ["parcel_flood_missing"]),
    ],
    truthMode: capTruthMode("full", input.aggregated.minimumTruthModeCap),
  };
}

export function deriveParcelAccessLocalOperatorResult(
  input: ParcelAccessLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);
  const coverageConfidence = input.corridorAccessAvailable ? "medium" : "low";

  const confidence = {
    evidenceConfidence: capConfidenceLevel(
      input.corridorAccessConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    methodConfidence: capConfidenceLevel(
      input.corridorAccessAvailable ? "medium" : "low",
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState: mergeMostRestrictiveSuppressionState([
      baselineSuppression,
      input.corridorAccessAvailable ? "downgraded" : "review_required",
    ]),
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: [
      ...(input.corridorAccessAvailable
        ? ["corridor_access_contextual"]
        : ["corridor_access_unavailable"]),
    ],
    truthMode: capTruthMode("derived_screening", input.aggregated.minimumTruthModeCap),
  };
}

export function derivePacketSectionExternalResult(
  input: PacketSectionLocalOperatorInput
): LocalConfidenceOperatorResult {
  const truthMode = capTruthMode(input.truthMode, input.truthModeCap);
  const confidence = {
    evidenceConfidence: capConfidenceLevel(
      input.confidence.evidenceConfidence,
      input.upstreamConfidence.evidenceConfidence
    ),
    methodConfidence: capConfidenceLevel(
      input.confidence.methodConfidence,
      input.upstreamConfidence.methodConfidence
    ),
    coverageConfidence: capConfidenceLevel(
      input.confidence.coverageConfidence,
      input.upstreamConfidence.coverageConfidence
    ),
    freshnessState: mergeWorstFreshnessState([
      input.confidence.freshnessState,
      input.upstreamConfidence.freshnessState,
    ]),
    suppressionState: deriveExternalPacketSuppressionState({
      sectionSuppressionState: input.confidence.suppressionState,
      upstreamSuppressionState: input.upstreamConfidence.suppressionState,
      truthModeCap: truthMode,
    }),
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: [
      ...(truthMode === input.truthMode ? [] : ["truth_mode_capped"]),
      ...(confidence.suppressionState === "none" ? [] : ["external_truth_enforcement"]),
    ],
    truthMode,
  };
}

export function derivePolicyPostureLocalOperatorResult(
  input: PolicyPostureLocalOperatorInput
): LocalConfidenceOperatorResult {
  const baselineSuppression = deriveBaselineSuppressionState(input.aggregated);
  const coverageConfidence = derivePolicyCoverageConfidence(input);

  const confidence = {
    evidenceConfidence: input.aggregated.minimumConstitutiveConfidenceCap,
    methodConfidence: capConfidenceLevel(
      input.geographyBindingConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    coverageConfidence: capConfidenceLevel(
      coverageConfidence,
      input.aggregated.minimumConstitutiveConfidenceCap
    ),
    freshnessState: input.aggregated.worstRequiredFreshnessState,
    suppressionState: baselineSuppression,
  };

  return {
    compatibilityBadge: deriveCompatibilityConfidenceBadge(confidence),
    confidence,
    suppressionReasons: baselineSuppression === "none" ? [] : ["policy_posture_degraded"],
    truthMode: capTruthMode("derived_screening", input.aggregated.minimumTruthModeCap),
  };
}
