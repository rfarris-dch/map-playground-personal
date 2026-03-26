import {
  MultiPolygonGeometrySchema,
  PolygonGeometrySchema,
} from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { trimmedEnumWithDefault } from "./_query-parsing.js";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const BoundaryPowerLevelSchema = z.enum(["county", "state", "country"]);
export type BoundaryPowerLevel = z.infer<typeof BoundaryPowerLevelSchema>;

export const BoundaryPowerRequestSchema = z.object({
  level: trimmedEnumWithDefault(BoundaryPowerLevelSchema, "county"),
});

export function parseBoundaryPowerLevelParam(value: string | undefined): BoundaryPowerLevel | null {
  if (typeof value === "undefined") {
    return null;
  }

  const parsed = BoundaryPowerLevelSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export const BoundaryPowerPropertiesSchema = z.object({
  level: BoundaryPowerLevelSchema,
  regionId: z.string().min(1),
  regionName: z.string().min(1),
  parentRegionName: z.string().min(1).nullable(),
  commissionedPowerMw: z.number().nonnegative(),
});

/** Boundaries are polygonal — tightened from generic GeometrySchema. */
export const BoundaryPowerFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: z.union([PolygonGeometrySchema, MultiPolygonGeometrySchema]),
  properties: BoundaryPowerPropertiesSchema,
});

export const BoundaryPowerFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(BoundaryPowerFeatureSchema),
  meta: ResponseMetaSchema,
});

export type BoundaryPowerProperties = z.infer<typeof BoundaryPowerPropertiesSchema>;
export type BoundaryPowerFeature = z.infer<typeof BoundaryPowerFeatureSchema>;
export type BoundaryPowerFeatureCollection = z.infer<typeof BoundaryPowerFeatureCollectionSchema>;
export type BoundaryPowerRequest = z.infer<typeof BoundaryPowerRequestSchema>;
