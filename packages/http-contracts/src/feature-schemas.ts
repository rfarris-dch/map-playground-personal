import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const FeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.union([z.string(), z.number()]).optional(),
  geometry: GeometrySchema,
  properties: z.record(z.unknown()),
});

export const FeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(FeatureSchema),
  meta: ResponseMetaSchema,
});

export type FeatureCollection = z.infer<typeof FeatureCollectionSchema>;
