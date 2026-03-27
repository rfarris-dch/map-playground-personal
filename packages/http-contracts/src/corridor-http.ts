import {
  MultiPolygonGeometrySchema,
  PointGeometrySchema,
} from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";
import { ConfidenceVectorSchema, TruthModeSchema } from "./confidence-http.js";

export const CorridorEntityTypeSchema = z.enum(["corridor", "hub"]);

export const CorridorMarketTreatmentSchema = z.enum(["validated_market", "derived_market"]);

export const CorridorValidationStateSchema = z.enum(["pass", "fail", "not_run"]);

export const CorridorEvidenceFamilySchema = z.enum(["transmission", "fiber", "substation", "gas"]);

export const CorridorObjectSchema = z.object({
  corridorId: z.string().min(1),
  entityType: CorridorEntityTypeSchema,
  marketId: z.string().min(1),
  marketName: z.string().min(1).nullable(),
  marketTreatment: CorridorMarketTreatmentSchema,
  truthMode: TruthModeSchema,
  confidence: ConfidenceVectorSchema,
  validationState: CorridorValidationStateSchema,
  evidenceFamilies: z.array(CorridorEvidenceFamilySchema),
  sourceIds: z.array(z.string().min(1)),
  routeDiversityScore: z.number().finite().nullable(),
  nearbySubstationCount: z.number().int().nonnegative().nullable(),
  centroid: PointGeometrySchema.shape.coordinates.nullable(),
  geometry: z.union([MultiPolygonGeometrySchema, PointGeometrySchema]),
});

export const CorridorCollectionResponseSchema = z.object({
  status: z.literal("ok"),
  rows: z.array(CorridorObjectSchema),
  meta: ResponseMetaSchema,
});

export type CorridorEntityType = z.infer<typeof CorridorEntityTypeSchema>;
export type CorridorMarketTreatment = z.infer<typeof CorridorMarketTreatmentSchema>;
export type CorridorValidationState = z.infer<typeof CorridorValidationStateSchema>;
export type CorridorEvidenceFamily = z.infer<typeof CorridorEvidenceFamilySchema>;
export type CorridorObject = z.infer<typeof CorridorObjectSchema>;
export type CorridorCollectionResponse = z.infer<typeof CorridorCollectionResponseSchema>;
