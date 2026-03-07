import type { z } from "zod";
import type {
  MarketSelectionMatchSchema,
  MarketsSelectionRequestSchema,
  MarketsSelectionResponseSchema,
  MarketsSelectionSummarySchema,
} from "./markets-selection-contracts";

export type MarketsSelectionRequest = z.infer<typeof MarketsSelectionRequestSchema>;

export type MarketSelectionMatch = z.infer<typeof MarketSelectionMatchSchema>;

export type MarketsSelectionSummary = z.infer<typeof MarketsSelectionSummarySchema>;

export type MarketSelectionResponse = z.infer<typeof MarketsSelectionResponseSchema>;
