import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const LaunchPolicySurfaceSchema = z.enum(["corridor", "county", "packet_export", "parcel"]);
export type LaunchPolicySurface = z.infer<typeof LaunchPolicySurfaceSchema>;

export const LaunchSurfaceScopeSchema = z.enum(["conditional", "mixed_market_modes", "national"]);
export type LaunchSurfaceScope = z.infer<typeof LaunchSurfaceScopeSchema>;

export const LaunchPolicyFlagTypeSchema = z.enum(["availability", "truth_enforcement"]);
export type LaunchPolicyFlagType = z.infer<typeof LaunchPolicyFlagTypeSchema>;

export const LaunchPolicyFlagNameSchema = z.enum([
  "FF_V1_CORRIDOR_B_TIER_CAP_ENFORCED",
  "FF_V1_CORRIDOR_CONFIDENCE_LABELS_REQUIRED",
  "FF_V1_CORRIDOR_NON_PRIORITY_VISIBLE",
  "FF_V1_CORRIDOR_STABILITY_GATE_ENFORCED",
  "FF_V1_CORRIDOR_SURFACE",
  "FF_V1_CORRIDOR_TIER_C_NOT_DEFINING",
  "FF_V1_CORRIDOR_VALIDATED_BADGE",
  "FF_V1_COUNTY_FEASIBILITY_CONTEXT",
  "FF_V1_COUNTY_MARKET_PRESSURE_ONLY",
  "FF_V1_COUNTY_SURFACE",
  "FF_V1_EXTERNAL_PACKET_EXPORTS",
  "FF_V1_EXTERNAL_PACKET_TRUTH_MODE",
  "FF_V1_LOW_CONFIDENCE_OR_STALE_SUPPRESSION",
  "FF_V1_MISSING_ZONING_FLOOD_NEVER_AUTO_PASS",
  "FF_V1_PARCEL_CORRIDOR_ACCESS",
  "FF_V1_PARCEL_CORRIDOR_NEVER_HARD_GATES",
  "FF_V1_PARCEL_SURFACE",
  "FF_V1_POLICY_WATCH_CONTEXT",
  "FF_V1_SUPPLY_TIMELINE_CONTEXT",
]);
export type LaunchPolicyFlagName = z.infer<typeof LaunchPolicyFlagNameSchema>;

export const NonPriorityCorridorModeSchema = z.enum(["derived_visible", "hidden", "internal_only"]);
export type NonPriorityCorridorMode = z.infer<typeof NonPriorityCorridorModeSchema>;

export const CorridorValidationProgramStateSchema = z.enum(["5_market_complete"]);
export type CorridorValidationProgramState = z.infer<typeof CorridorValidationProgramStateSchema>;

export const ValidatedMarketStatusSchema = z.enum(["validated_strong_pass"]);
export type ValidatedMarketStatus = z.infer<typeof ValidatedMarketStatusSchema>;

export const LaunchPolicyFlagSchema = z.object({
  name: LaunchPolicyFlagNameSchema,
  flagType: LaunchPolicyFlagTypeSchema,
  appliesTo: z.array(LaunchPolicySurfaceSchema).min(1),
  defaultEnabled: z.boolean(),
  description: z.string().min(1),
  disabledBehavior: z.string().min(1),
  productionOffAllowed: z.boolean(),
});
export type LaunchPolicyFlag = z.infer<typeof LaunchPolicyFlagSchema>;

export const ValidatedCorridorMarketSchema = z.object({
  marketId: z.string().min(1),
  displayName: z.string().min(1),
  validationStatus: ValidatedMarketStatusSchema,
  validationSiteLabel: z.string().min(1),
  minSeparationFt: z.number().nonnegative(),
  pairsUnderQuarterMile: z.number().int().nonnegative(),
  notes: z.string().min(1).nullable(),
  effectiveFrom: z.string().date(),
  policyVersion: z.string().min(1),
});
export type ValidatedCorridorMarket = z.infer<typeof ValidatedCorridorMarketSchema>;

export const LaunchSurfacePostureSchema = z.object({
  surface: LaunchPolicySurfaceSchema,
  defaultEnabled: z.boolean(),
  launchScope: LaunchSurfaceScopeSchema,
  summary: z.string().min(1),
});
export type LaunchSurfacePosture = z.infer<typeof LaunchSurfacePostureSchema>;

export const LaunchPolicyCopySchema = z.object({
  countyNonPriorityCorridorCopy: z.string().min(1),
  corridorDerivedLabel: z.string().min(1),
  corridorNonPriorityCaveat: z.string().min(1),
  gtmSafeSummary: z.string().min(1),
  parcelUnavailableAccessCopy: z.string().min(1),
});
export type LaunchPolicyCopy = z.infer<typeof LaunchPolicyCopySchema>;

export const LaunchPolicyConfigSchema = z.object({
  policyVersion: z.string().min(1),
  effectiveFrom: z.string().date(),
  confidencePolicyVersion: z.string().min(1),
  truthPolicyVersion: z.string().min(1),
  corridorValidationProgramState: CorridorValidationProgramStateSchema,
  nonPriorityCorridorMode: NonPriorityCorridorModeSchema,
  validatedCorridorMarkets: z.array(ValidatedCorridorMarketSchema).min(1),
  surfacePosture: z.array(LaunchSurfacePostureSchema).min(1),
  availabilityFlags: z.array(LaunchPolicyFlagSchema).min(1),
  truthEnforcementFlags: z.array(LaunchPolicyFlagSchema).min(1),
  copy: LaunchPolicyCopySchema,
  rollbackOrder: z.array(z.string().min(1)).min(1),
});
export type LaunchPolicyConfig = z.infer<typeof LaunchPolicyConfigSchema>;

export const LaunchPolicyResponseSchema = LaunchPolicyConfigSchema.extend({
  meta: ResponseMetaSchema,
});
export type LaunchPolicyResponse = z.infer<typeof LaunchPolicyResponseSchema>;
