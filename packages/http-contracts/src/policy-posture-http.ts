import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";
import { ConfidenceVectorSchema, TruthModeSchema } from "./confidence-http.js";

export const PolicyPostureGeographyScopeSchema = z.enum([
  "national",
  "market",
  "state",
  "county",
  "corridor",
  "parcel",
]);

export const PolicyPostureSchema = z.object({
  postureId: z.string().min(1),
  geographyScope: PolicyPostureGeographyScopeSchema,
  geographyKey: z.string().min(1),
  effectiveDate: z.string().date(),
  truthMode: TruthModeSchema,
  confidence: ConfidenceVectorSchema,
  sourceIds: z.array(z.string().min(1)),
  eventCount: z.number().int().nonnegative(),
  jurisdictionCoverageShare: z.number().min(0).max(1).nullable(),
  summary: z.string().min(1).nullable(),
});

export const PolicyPostureCollectionResponseSchema = z.object({
  status: z.literal("ok"),
  rows: z.array(PolicyPostureSchema),
  meta: ResponseMetaSchema,
});

export type PolicyPostureGeographyScope = z.infer<typeof PolicyPostureGeographyScopeSchema>;
export type PolicyPosture = z.infer<typeof PolicyPostureSchema>;
export type PolicyPostureCollectionResponse = z.infer<typeof PolicyPostureCollectionResponseSchema>;
