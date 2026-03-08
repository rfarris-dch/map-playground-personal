import { z } from "zod";
import { PointGeometrySchema, PolygonGeometrySchema, ResponseMetaSchema } from "./shared-contracts";
import { MarketTableRowSchema } from "./table-contracts";

export const MarketSelectionMatchSchema = MarketTableRowSchema.extend({
  intersectionAreaSqKm: z.number().nonnegative(),
  isPrimary: z.boolean(),
  marketCenter: PointGeometrySchema.nullable(),
  marketOverlapPercent: z.number().min(0).max(1),
  selectionOverlapPercent: z.number().min(0).max(1),
});

export const MarketsSelectionRequestSchema = z.object({
  geometry: PolygonGeometrySchema,
  limit: z.number().int().positive().max(100).default(25),
  minimumSelectionOverlapPercent: z.number().min(0).max(1).default(0),
});

export const MarketsSelectionSummarySchema = z.object({
  matchCount: z.number().int().nonnegative(),
  minimumSelectionOverlapPercent: z.number().min(0).max(1),
  primaryMarketId: z.string().nullable(),
  selectionAreaSqKm: z.number().nonnegative(),
});

export const MarketsSelectionResponseSchema = z.object({
  matchedMarkets: z.array(MarketSelectionMatchSchema),
  meta: ResponseMetaSchema,
  primaryMarket: MarketSelectionMatchSchema.nullable(),
  selection: MarketsSelectionSummarySchema,
});

export type MarketSelectionMatch = z.infer<typeof MarketSelectionMatchSchema>;
export type MarketsSelectionRequest = z.infer<typeof MarketsSelectionRequestSchema>;
export type MarketsSelectionSummary = z.infer<typeof MarketsSelectionSummarySchema>;
export type MarketSelectionResponse = z.infer<typeof MarketsSelectionResponseSchema>;
