import { z } from "zod";
import { GeometrySchema, ResponseMetaSchema } from "@/shared-contracts";
import type { BoundaryPowerLevel } from "./boundaries-contracts.types";

export type {
  BoundaryPowerFeature,
  BoundaryPowerFeatureCollection,
  BoundaryPowerLevel,
  BoundaryPowerProperties,
} from "./boundaries-contracts.types";

export const BoundaryPowerLevelSchema = z.enum(["county", "state", "country"]);

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

export const BoundaryPowerFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: GeometrySchema,
  properties: BoundaryPowerPropertiesSchema,
});

export const BoundaryPowerFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(BoundaryPowerFeatureSchema),
  meta: ResponseMetaSchema,
});
