import type { z } from "zod";
import type {
  ApiErrorResponseSchema,
  ApiErrorSchema,
  CommissionedSemanticSchema,
  FacilityPerspectiveSchema,
  FeatureCollectionSchema,
  LeaseOrOwnSchema,
  ResponseMetaSchema,
  SourceModeSchema,
  WarningSchema,
} from "./shared-contracts";

export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;

export interface BBox {
  readonly east: number;
  readonly north: number;
  readonly south: number;
  readonly west: number;
}

export interface SafeParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ResponseMeta = z.infer<typeof ResponseMetaSchema>;

export type Warning = z.infer<typeof WarningSchema>;

export type LeaseOrOwn = z.infer<typeof LeaseOrOwnSchema>;

export type CommissionedSemantic = z.infer<typeof CommissionedSemanticSchema>;

export type FacilityPerspective = z.infer<typeof FacilityPerspectiveSchema>;

export type SourceMode = z.infer<typeof SourceModeSchema>;
