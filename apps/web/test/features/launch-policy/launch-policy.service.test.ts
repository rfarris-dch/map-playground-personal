import { describe, expect, it } from "bun:test";
import {
  listValidatedCorridorMarketLabels,
  resolveLaunchPolicyMarketTreatment,
} from "../../../src/features/launch-policy/launch-policy.service";
import type { LaunchPolicyModel } from "../../../src/features/launch-policy/launch-policy.types";

function createLaunchPolicy(): LaunchPolicyModel {
  return {
    policyVersion: "v1",
    effectiveFrom: "2026-03-26",
    confidencePolicyVersion: "v1",
    truthPolicyVersion: "v1",
    corridorValidationProgramState: "5_market_complete",
    nonPriorityCorridorMode: "derived_visible",
    validatedCorridorMarkets: [
      {
        marketId: "318",
        displayName: "Atlanta",
        validationStatus: "validated_strong_pass",
        validationSiteLabel: "Atlanta Northeast",
        minSeparationFt: 22,
        pairsUnderQuarterMile: 12,
        notes: null,
        effectiveFrom: "2026-03-26",
        policyVersion: "v1",
      },
      {
        marketId: "649",
        displayName: "Northern Virginia",
        validationStatus: "validated_strong_pass",
        validationSiteLabel: "Northern Virginia",
        minSeparationFt: 917,
        pairsUnderQuarterMile: 2,
        notes: null,
        effectiveFrom: "2026-03-26",
        policyVersion: "v1",
      },
    ],
    surfacePosture: [
      {
        surface: "county",
        defaultEnabled: true,
        launchScope: "national",
        summary: "County launches nationally.",
      },
    ],
    availabilityFlags: [],
    truthEnforcementFlags: [
      {
        name: "FF_V1_COUNTY_MARKET_PRESSURE_ONLY",
        flagType: "truth_enforcement",
        appliesTo: ["county"],
        defaultEnabled: true,
        description: "County remains market-pressure only.",
        disabledBehavior: "Off is disallowed.",
        productionOffAllowed: false,
      },
    ],
    copy: {
      countyNonPriorityCorridorCopy:
        "Corridor context in this market is derived from infrastructure-overlap screening and should be used directionally, not as surveyed ROW truth.",
      corridorDerivedLabel: "Derived corridor",
      corridorNonPriorityCaveat:
        "Not surveyed ROW truth. Directional screening only. Does not imply deliverable capacity or utility-confirmed service.",
      gtmSafeSummary: "County first, corridor second, parcel third.",
      parcelUnavailableAccessCopy: "Unavailable.",
    },
    rollbackOrder: ["Disable FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE."],
    meta: {
      requestId: "req-1",
      sourceMode: "postgis",
      dataVersion: "launch-policy-v1-2026-03-26",
      generatedAt: "2026-03-26T00:00:00.000Z",
      recordCount: 2,
      truncated: false,
      warnings: [],
    },
  };
}

describe("launch policy service", () => {
  it("lists validated corridor market labels in order", () => {
    expect(listValidatedCorridorMarketLabels(createLaunchPolicy())).toEqual([
      "Atlanta",
      "Northern Virginia",
    ]);
  });

  it("resolves validated and derived market treatment", () => {
    const policy = createLaunchPolicy();

    expect(resolveLaunchPolicyMarketTreatment(policy, "318")).toMatchObject({
      isValidated: true,
      label: "Validated market",
      marketName: "Atlanta",
    });

    expect(resolveLaunchPolicyMarketTreatment(policy, "645")).toMatchObject({
      isValidated: false,
      label: "Derived corridor",
      marketId: "645",
      summary: policy.copy.countyNonPriorityCorridorCopy,
    });
  });
});
