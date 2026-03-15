import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";

function trimQueryValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const MarketBoundaryLevelSchema = z.enum(["market", "submarket"]);
export type MarketBoundaryLevel = z.infer<typeof MarketBoundaryLevelSchema>;

export const MarketBoundaryRequestSchema = z.object({
  level: z.preprocess(trimQueryValue, MarketBoundaryLevelSchema).default("market"),
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

export const MarketBoundaryFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: z.string(),
  geometry: GeometrySchema,
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
