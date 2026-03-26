import {
  MultiPolygonGeometrySchema,
  PolygonGeometrySchema,
} from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { trimmedEnumWithDefault, trimQueryValue } from "./_query-parsing.js";
import { ResponseMetaSchema } from "./api-response-meta.js";

export const MarketBoundaryLevelSchema = z.enum(["market", "submarket"]);
export type MarketBoundaryLevel = z.infer<typeof MarketBoundaryLevelSchema>;

/**
 * FIX: `version` is now modeled in the request schema. Previously the
 * route builder hardcoded `v=4` but the schema didn't know about it.
 */
export const MarketBoundaryRequestSchema = z.object({
  level: trimmedEnumWithDefault(MarketBoundaryLevelSchema, "market"),
  version: z.preprocess(trimQueryValue, z.string().min(1)).optional(),
});

export function parseMarketBoundaryLevelParam(
  value: string | undefined
): MarketBoundaryLevel | null {
  if (typeof value === "undefined") {
    return null;
  }

  const parsed = MarketBoundaryLevelSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

export const MarketBoundaryPropertiesSchema = z.object({
  level: MarketBoundaryLevelSchema,
  regionId: z.string().min(1),
  regionName: z.string().min(1),
  parentRegionName: z.string().min(1).nullable(),
  marketId: z.string().min(1),
  absorption: z.number().nullable(),
  vacancy: z.number().nullable(),
  commissionedPowerMw: z.number().nonnegative().nullable(),
});

/** Market boundaries are polygonal — tightened from generic GeometrySchema. */
export const MarketBoundaryFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: z.union([PolygonGeometrySchema, MultiPolygonGeometrySchema]),
  properties: MarketBoundaryPropertiesSchema,
});

export const MarketBoundaryFeatureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(MarketBoundaryFeatureSchema),
  meta: ResponseMetaSchema,
});

export type MarketBoundaryProperties = z.infer<typeof MarketBoundaryPropertiesSchema>;
export type MarketBoundaryFeature = z.infer<typeof MarketBoundaryFeatureSchema>;
export type MarketBoundaryFeatureCollection = z.infer<typeof MarketBoundaryFeatureCollectionSchema>;
export type MarketBoundaryRequest = z.infer<typeof MarketBoundaryRequestSchema>;
