import { z } from "zod";
import { ResponseMetaSchema } from "./shared-contracts";

const CountyFipsSchema = z.string().regex(/^[0-9]{5}$/);
const CountyScoreStatusSchema = z.enum(["scored", "unavailable"]);
const CountyScoreFeatureCoverageSchema = z.object({
  enterprise: z.boolean(),
  facilities: z.boolean(),
  fiber: z.boolean(),
  hazards: z.boolean(),
  hyperscale: z.boolean(),
  policy: z.boolean(),
  terrain: z.boolean(),
  transmission: z.boolean(),
  utilityTerritory: z.boolean(),
  waterStress: z.boolean(),
});

export const CountyScoreSchema = z.object({
  countyFips: CountyFipsSchema,
  countyName: z.string().min(1).nullable(),
  stateAbbrev: z.string().length(2).nullable(),
  scoreStatus: CountyScoreStatusSchema,
  compositeScore: z.number().finite().nullable(),
  demandScore: z.number().finite().nullable(),
  generationScore: z.number().finite().nullable(),
  policyScore: z.number().finite().nullable(),
  formulaVersion: z.string().min(1).nullable(),
  inputDataVersion: z.string().min(1).nullable(),
});

export const CountyScoresSummarySchema = z.object({
  requestedCountyIds: z.array(CountyFipsSchema),
  missingCountyIds: z.array(CountyFipsSchema),
  unavailableCountyIds: z.array(CountyFipsSchema),
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
  scoredCountyCount: z.number().int().nonnegative(),
  waterCoverageCount: z.number().int().nonnegative(),
  availableFeatureFamilies: z.array(z.string().min(1)),
  missingFeatureFamilies: z.array(z.string().min(1)),
  featureCoverage: CountyScoreFeatureCoverageSchema,
  meta: ResponseMetaSchema,
});

export type CountyScore = z.infer<typeof CountyScoreSchema>;
export type CountyScoresSummary = z.infer<typeof CountyScoresSummarySchema>;
export type CountyScoresResponse = z.infer<typeof CountyScoresResponseSchema>;
export type CountyScoresStatusResponse = z.infer<typeof CountyScoresStatusResponseSchema>;
