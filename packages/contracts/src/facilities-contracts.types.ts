import type { z } from "zod";
import type {
  FacilitiesDetailFeatureSchema,
  FacilitiesDetailResponseSchema,
  FacilitiesFeatureCollectionSchema,
  FacilitiesFeatureSchema,
  FacilitiesSelectionRequestSchema,
  FacilitiesSelectionResponseSchema,
} from "./facilities-contracts";

export type FacilitiesDetailResponse = z.infer<typeof FacilitiesDetailResponseSchema>;

export type FacilitiesDetailFeature = z.infer<typeof FacilitiesDetailFeatureSchema>;

export type FacilitiesSelectionResponse = z.infer<typeof FacilitiesSelectionResponseSchema>;

export type FacilitiesSelectionRequest = z.infer<typeof FacilitiesSelectionRequestSchema>;

export type FacilitiesFeatureCollection = z.infer<typeof FacilitiesFeatureCollectionSchema>;

export type FacilitiesFeature = z.infer<typeof FacilitiesFeatureSchema>;
