import { describe, expect, it } from "bun:test";
import {
  aggregateDependencyEffects,
  deriveCatchmentLocalOperatorResult,
  deriveCorridorLocalOperatorResult,
  deriveCountyLocalOperatorResult,
  derivePacketSectionExternalResult,
  deriveParcelGateLocalOperatorResult,
  derivePolicyPostureLocalOperatorResult,
} from "./confidence-engine";
import type { DependencyRuntimeEffect } from "./confidence-engine.types";

function createEffect(overrides: Partial<DependencyRuntimeEffect> = {}): DependencyRuntimeEffect {
  return {
    accessStatus: "accessible",
    completenessObserved: 1,
    confidenceCap: "high",
    degradeTriggered: false,
    downstreamObjectId: "county_market_pressure_primary",
    downstreamObjectType: "score",
    effectiveFreshnessState: "fresh",
    missingTriggered: false,
    precisionTier: "A",
    requiredness: "required",
    roleInDownstream: "primary",
    sourceAgeDays: 1,
    sourceId: "source-1",
    sourceName: "Source 1",
    stalenessState: "fresh",
    suppressTriggered: false,
    truthModeCap: "full",
    warnTriggered: false,
    ...overrides,
  };
}

describe("confidence engine", () => {
  it("aggregates dependency caps conservatively", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [
      createEffect({
        confidenceCap: "medium",
        effectiveFreshnessState: "aging",
        sourceId: "source-1",
      }),
      createEffect({
        confidenceCap: "high",
        effectiveFreshnessState: "fresh",
        sourceId: "source-2",
        sourceName: "Source 2",
      }),
    ]);

    expect(aggregated.minimumConstitutiveConfidenceCap).toBe("medium");
    expect(aggregated.minimumTruthModeCap).toBe("full");
    expect(aggregated.worstRequiredFreshnessState).toBe("aging");
    expect(aggregated.agingRequiredSourceCount).toBe(1);
  });

  it("keeps county contextual gaps out of core suppression", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [createEffect()]);
    const result = deriveCountyLocalOperatorResult({
      aggregated,
      demandPressureAvailable: true,
      hasLowConfidenceMapping: false,
      isSeamCounty: false,
      operatorZoneConfidence: "unknown",
      policyMappingConfidence: "unknown",
      rankStatus: "ranked",
    });

    expect(result.confidence.suppressionState).toBe("none");
    expect(result.truthMode).toBe("full");
  });

  it("downgrades catchment confidence when point-touch weighting dominates", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [
      createEffect({
        downstreamObjectId: "county_market_pressure_catchment",
        downstreamObjectType: "score",
      }),
    ]);

    const result = deriveCatchmentLocalOperatorResult({
      adjacencyAvailable: true,
      aggregated,
      neighborCount: 4,
      pointTouchWeightShare: 0.4,
      totalWeightMass: 2.5,
    });

    expect(result.confidence.methodConfidence).toBe("medium");
    expect(result.confidence.coverageConfidence).toBe("medium");
  });

  it("caps B+B corridor evidence at medium and suppresses unstable outputs", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [
      createEffect({
        confidenceCap: "high",
        downstreamObjectId: "corridor_ribbon",
        downstreamObjectType: "feature",
        truthModeCap: "validated_screening",
      }),
      createEffect({
        confidenceCap: "high",
        downstreamObjectId: "corridor_ribbon",
        downstreamObjectType: "feature",
        sourceId: "source-2",
        sourceName: "Source 2",
        truthModeCap: "derived_screening",
      }),
    ]);

    const result = deriveCorridorLocalOperatorResult({
      aggregated,
      definingPrecisionTiers: ["B", "B"],
      evidenceFamilies: ["transmission", "fiber"],
      marketTreatment: "derived_market",
      routeDiversityScore: 0.7,
      stabilityState: "fail",
      validationState: "pass",
    });

    expect(result.confidence.evidenceConfidence).toBe("medium");
    expect(result.confidence.suppressionState).toBe("suppressed");
    expect(result.truthMode).toBe("derived_screening");
  });

  it("forces parcel review when zoning or flood is missing", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [
      createEffect({
        downstreamObjectId: "parcel_pre_diligence_gate",
        downstreamObjectType: "feature",
      }),
    ]);

    const result = deriveParcelGateLocalOperatorResult({
      aggregated,
      floodAvailable: false,
      geometryAvailable: true,
      protectedLandAvailable: true,
      zoningAvailable: true,
    });

    expect(result.confidence.suppressionState).toBe("review_required");
    expect(result.confidence.coverageConfidence).toBe("low");
  });

  it("never lets external packet output exceed truth mode caps", () => {
    const result = derivePacketSectionExternalResult({
      confidence: {
        coverageConfidence: "high",
        evidenceConfidence: "high",
        freshnessState: "fresh",
        methodConfidence: "high",
        suppressionState: "downgraded",
      },
      truthMode: "validated_screening",
      truthModeCap: "internal_only",
      upstreamConfidence: {
        coverageConfidence: "medium",
        evidenceConfidence: "medium",
        freshnessState: "aging",
        methodConfidence: "medium",
        suppressionState: "none",
      },
    });

    expect(result.truthMode).toBe("internal_only");
    expect(result.confidence.suppressionState).toBe("suppressed");
  });

  it("caps policy posture by coverage and registry constraints", () => {
    const aggregated = aggregateDependencyEffects("registry-v1", [
      createEffect({
        confidenceCap: "medium",
        downstreamObjectId: "policy_posture_state",
        downstreamObjectType: "feature",
        truthModeCap: "derived_screening",
      }),
    ]);

    const result = derivePolicyPostureLocalOperatorResult({
      aggregated,
      geographyBindingConfidence: "high",
      jurisdictionCoverageShare: 0.5,
    });

    expect(result.confidence.evidenceConfidence).toBe("medium");
    expect(result.confidence.coverageConfidence).toBe("low");
    expect(result.truthMode).toBe("derived_screening");
  });
});
