/**
 * Licensing and governance policy contracts.
 *
 * Split from analysis-contracts.ts. These define data sensitivity tiers,
 * allowed query/export granularities, and redistribution rules — domain
 * policy, not HTTP transport shapes.
 */
import { z } from "zod";
import { MarketMetricDefinitionsSchema } from "./market-metrics-http.js";

export const PolicyDatasetSchema = z.enum([
  "county_scores",
  "parcels",
  "facilities",
  "environmental_flood",
  "power",
  "fiber",
  "market_metrics",
]);
export const PolicySensitivityTierSchema = z.enum(["public", "internal", "restricted"]);
export const QueryGranularitySchema = z.enum([
  "bbox",
  "polygon",
  "county",
  "tileSet",
  "parcel",
  "facility",
  "market",
  "state",
  "country",
]);
export const ExportGranularitySchema = z.enum([
  "none",
  "parcel",
  "facility",
  "county",
  "market",
  "state",
  "country",
]);
export const RedistributionPolicySchema = z.enum(["none", "internal", "partner", "public"]);

export const DatasetLicensingPolicySchema = z.object({
  dataset: PolicyDatasetSchema,
  sensitivityTier: PolicySensitivityTierSchema,
  allowedQueryGranularities: z.array(QueryGranularitySchema).min(1),
  allowedExportGranularities: z.array(ExportGranularitySchema).min(1),
  minimumKAnonymity: z.number().int().positive().nullable(),
  cacheTtlSeconds: z.number().int().positive(),
  retentionDays: z.number().int().positive(),
  redistribution: RedistributionPolicySchema,
  owner: z.string().min(1),
  dueDate: z.string().date(),
});

export const SpatialAnalysisPolicySchema = z.object({
  marketMetrics: MarketMetricDefinitionsSchema,
  licensing: z.array(DatasetLicensingPolicySchema).min(1),
});

export type PolicyDataset = z.infer<typeof PolicyDatasetSchema>;
export type PolicySensitivityTier = z.infer<typeof PolicySensitivityTierSchema>;
export type QueryGranularity = z.infer<typeof QueryGranularitySchema>;
export type ExportGranularity = z.infer<typeof ExportGranularitySchema>;
export type RedistributionPolicy = z.infer<typeof RedistributionPolicySchema>;
export type DatasetLicensingPolicy = z.infer<typeof DatasetLicensingPolicySchema>;
export type SpatialAnalysisPolicy = z.infer<typeof SpatialAnalysisPolicySchema>;
