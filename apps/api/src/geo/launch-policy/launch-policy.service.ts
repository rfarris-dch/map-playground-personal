import {
  type LaunchPolicyConfig,
  LaunchPolicyConfigSchema,
  type LaunchPolicyFlag,
  type LaunchSurfacePosture,
  type ValidatedCorridorMarket,
} from "@map-migration/http-contracts/launch-policy-http";

const POLICY_VERSION = "v1";
const EFFECTIVE_FROM = "2026-03-26";

const validatedCorridorMarkets: readonly ValidatedCorridorMarket[] = [
  {
    marketId: "318",
    displayName: "Atlanta",
    validationStatus: "validated_strong_pass",
    validationSiteLabel: "Atlanta Northeast",
    minSeparationFt: 22,
    pairsUnderQuarterMile: 12,
    notes: "100% imagery validation mix",
    effectiveFrom: EFFECTIVE_FROM,
    policyVersion: POLICY_VERSION,
  },
  {
    marketId: "559",
    displayName: "Phoenix",
    validationStatus: "validated_strong_pass",
    validationSiteLabel: "Phoenix West",
    minSeparationFt: 29,
    pairsUnderQuarterMile: 1,
    notes: "Imagery and OTHER validation mix",
    effectiveFrom: EFFECTIVE_FROM,
    policyVersion: POLICY_VERSION,
  },
  {
    marketId: "364",
    displayName: "Chicago",
    validationStatus: "validated_strong_pass",
    validationSiteLabel: "Chicago West",
    minSeparationFt: 116,
    pairsUnderQuarterMile: 52,
    notes: "100% imagery validation mix",
    effectiveFrom: EFFECTIVE_FROM,
    policyVersion: POLICY_VERSION,
  },
  {
    marketId: "382",
    displayName: "Dallas/Fort Worth",
    validationStatus: "validated_strong_pass",
    validationSiteLabel: "Dallas-Fort Worth",
    minSeparationFt: 116,
    pairsUnderQuarterMile: 7,
    notes: "Mixed imagery and OTHER validation mix",
    effectiveFrom: EFFECTIVE_FROM,
    policyVersion: POLICY_VERSION,
  },
  {
    marketId: "649",
    displayName: "Northern Virginia",
    validationStatus: "validated_strong_pass",
    validationSiteLabel: "Northern Virginia",
    minSeparationFt: 917,
    pairsUnderQuarterMile: 2,
    notes: "100% imagery validation mix",
    effectiveFrom: EFFECTIVE_FROM,
    policyVersion: POLICY_VERSION,
  },
];

const surfacePosture: readonly LaunchSurfacePosture[] = [
  {
    surface: "county",
    defaultEnabled: true,
    launchScope: "national",
    summary: "County launches nationally as the discovery and market-pressure triage surface.",
  },
  {
    surface: "corridor",
    defaultEnabled: true,
    launchScope: "mixed_market_modes",
    summary:
      "Corridor launches in validated-market mode for 5 markets and derived-market mode elsewhere.",
  },
  {
    surface: "parcel",
    defaultEnabled: true,
    launchScope: "national",
    summary:
      "Parcel launches nationally, with corridor access treated as contextual screening input.",
  },
  {
    surface: "packet_export",
    defaultEnabled: true,
    launchScope: "conditional",
    summary:
      "External packet export remains enabled only while truth-mode enforcement checks pass.",
  },
];

const availabilityFlags: readonly LaunchPolicyFlag[] = [
  {
    name: "FF_V1_COUNTY_SURFACE",
    flagType: "availability",
    appliesTo: ["county"],
    defaultEnabled: true,
    description: "Enables the county triage surface.",
    disabledBehavior: "County experience is hidden.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_COUNTY_FEASIBILITY_CONTEXT",
    flagType: "availability",
    appliesTo: ["county"],
    defaultEnabled: true,
    description: "Shows supply timeline and grid friction as contextual county badges only.",
    disabledBehavior: "County remains available but contextual feasibility badges are hidden.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_SUPPLY_TIMELINE_CONTEXT",
    flagType: "availability",
    appliesTo: ["county", "corridor", "parcel"],
    defaultEnabled: false,
    description:
      "Enables supply-timeline bands, badges, and narratives once queue launch gates pass.",
    disabledBehavior:
      "Supply-timeline content is hidden while county, corridor, and parcel still launch.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_POLICY_WATCH_CONTEXT",
    flagType: "availability",
    appliesTo: ["county", "corridor", "parcel"],
    defaultEnabled: false,
    description: "Enables policy-watch context once EQ Research and posture rules are ready.",
    disabledBehavior:
      "Policy-watch content is hidden or limited to current legacy posture context.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_CORRIDOR_SURFACE",
    flagType: "availability",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Enables corridor entry points and map layers.",
    disabledBehavior: "Corridor experience is hidden everywhere.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_CORRIDOR_VALIDATED_BADGE",
    flagType: "availability",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Shows validated-market treatment in allowlisted markets.",
    disabledBehavior: "No validated badge is shown, but validated-market mode still applies.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE",
    flagType: "availability",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Allows non-priority markets to show derived corridors.",
    disabledBehavior: "Non-priority corridors are hidden.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_PARCEL_SURFACE",
    flagType: "availability",
    appliesTo: ["parcel"],
    defaultEnabled: true,
    description: "Enables the parcel pre-diligence surface.",
    disabledBehavior: "Parcel experience is hidden.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_PARCEL_CORRIDOR_ACCESS",
    flagType: "availability",
    appliesTo: ["parcel"],
    defaultEnabled: true,
    description: "Shows corridor and hub access metrics where corridor data survives policy gates.",
    disabledBehavior: "Parcel remains live, but the corridor access section is omitted.",
    productionOffAllowed: true,
  },
  {
    name: "FF_V1_EXTERNAL_PACKET_EXPORTS",
    flagType: "availability",
    appliesTo: ["packet_export"],
    defaultEnabled: true,
    description: "Enables the external packet export renderer.",
    disabledBehavior: "External exports are disabled while analyst/internal views remain live.",
    productionOffAllowed: true,
  },
];

const truthEnforcementFlags: readonly LaunchPolicyFlag[] = [
  {
    name: "FF_V1_COUNTY_MARKET_PRESSURE_ONLY",
    flagType: "truth_enforcement",
    appliesTo: ["county"],
    defaultEnabled: true,
    description: "County ranking excludes supply timeline and grid friction as ranking pillars.",
    disabledBehavior:
      "Production off state is disallowed because county ranking truth would be violated.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_CORRIDOR_CONFIDENCE_LABELS_REQUIRED",
    flagType: "truth_enforcement",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Every displayed corridor or hub carries explicit confidence labeling.",
    disabledBehavior:
      "Production off state is disallowed because corridor truth would be overstated.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_CORRIDOR_STABILITY_GATE_ENFORCED",
    flagType: "truth_enforcement",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Unstable or not-run corridors are suppressed.",
    disabledBehavior:
      "Production off state is disallowed because unstable corridors would leak through.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_CORRIDOR_B_TIER_CAP_ENFORCED",
    flagType: "truth_enforcement",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Tier B + Tier B corridors cannot exceed Medium evidence confidence.",
    disabledBehavior:
      "Production off state is disallowed because evidence confidence would be overstated.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_CORRIDOR_TIER_C_NOT_DEFINING",
    flagType: "truth_enforcement",
    appliesTo: ["corridor"],
    defaultEnabled: true,
    description: "Tier C sources remain context-only and never define corridors.",
    disabledBehavior:
      "Production off state is disallowed because unsupported linework could define corridors.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_PARCEL_CORRIDOR_NEVER_HARD_GATES",
    flagType: "truth_enforcement",
    appliesTo: ["parcel"],
    defaultEnabled: true,
    description: "Corridors cannot drive parcel hard fail/pass gating.",
    disabledBehavior: "Production off state is disallowed because parcel gate truth would change.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_MISSING_ZONING_FLOOD_NEVER_AUTO_PASS",
    flagType: "truth_enforcement",
    appliesTo: ["parcel"],
    defaultEnabled: true,
    description: "Missing zoning or flood data cannot silently pass.",
    disabledBehavior:
      "Production off state is disallowed because uncertainty would be hidden from parcel decisions.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_EXTERNAL_PACKET_TRUTH_MODE",
    flagType: "truth_enforcement",
    appliesTo: ["packet_export"],
    defaultEnabled: true,
    description: "External packet wording cannot exceed internal truthfulness.",
    disabledBehavior:
      "Production off state is disallowed because external packet copy could overclaim certainty.",
    productionOffAllowed: false,
  },
  {
    name: "FF_V1_LOW_CONFIDENCE_OR_STALE_SUPPRESSION",
    flagType: "truth_enforcement",
    appliesTo: ["county", "corridor", "parcel", "packet_export"],
    defaultEnabled: true,
    description: "Low-confidence or stale outputs are downgraded or suppressed across surfaces.",
    disabledBehavior:
      "Production off state is disallowed because stale or weak outputs would be silently asserted.",
    productionOffAllowed: false,
  },
];

const launchPolicyConfig: LaunchPolicyConfig = LaunchPolicyConfigSchema.parse({
  policyVersion: POLICY_VERSION,
  effectiveFrom: EFFECTIVE_FROM,
  confidencePolicyVersion: "v1",
  truthPolicyVersion: "v1",
  corridorValidationProgramState: "5_market_complete",
  nonPriorityCorridorMode: "derived_visible",
  validatedCorridorMarkets,
  surfacePosture,
  availabilityFlags,
  truthEnforcementFlags,
  copy: {
    countyNonPriorityCorridorCopy:
      "Corridor context in this market is derived from infrastructure-overlap screening and should be used directionally, not as surveyed ROW truth.",
    corridorDerivedLabel: "Derived corridor",
    corridorNonPriorityCaveat:
      "Not surveyed ROW truth. Directional screening only. Does not imply deliverable capacity or utility-confirmed service.",
    gtmSafeSummary:
      "County tells you where to look next. Corridor tells you what infrastructure and friction may actually matter there. Parcel tells you what survives first-pass diligence. Outside our validated corridor markets, corridor outputs remain visible but are explicitly labeled as derived screening outputs rather than surveyed route truth.",
    parcelUnavailableAccessCopy:
      "Corridor access is unavailable for this market or object and is not used as a hard parcel gate.",
  },
  rollbackOrder: [
    "Disable FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE.",
    "Disable FF_V1_CORRIDOR_SURFACE globally if needed.",
    "Disable FF_V1_PARCEL_CORRIDOR_ACCESS while keeping parcel hard gates live if needed.",
    "Keep county surface live unless county publication itself is compromised.",
  ],
});

export function getLaunchPolicyConfig(): LaunchPolicyConfig {
  return launchPolicyConfig;
}

export function isValidatedCorridorMarket(marketId: string | null | undefined): boolean {
  if (typeof marketId !== "string" || marketId.trim().length === 0) {
    return false;
  }

  return launchPolicyConfig.validatedCorridorMarkets.some((market) => market.marketId === marketId);
}

export function listValidatedCorridorMarketIds(): readonly string[] {
  return launchPolicyConfig.validatedCorridorMarkets.map((market) => market.marketId);
}

export function resolveCorridorMarketTreatment(
  marketId: string | null | undefined
): "derived_market" | "validated_market" {
  if (isValidatedCorridorMarket(marketId)) {
    return "validated_market";
  }

  return "derived_market";
}
