/**
 * Market metric definitions — domain policy for how market metrics
 * are computed, windowed, and aggregated.
 *
 * Split from analysis-contracts.ts. These are domain policy/config,
 * not HTTP transport contracts.
 */
import { z } from "zod";

export const MarketMetricKeySchema = z.enum(["market_size", "absorption", "vacancy"]);
export const MetricTimeWindowSchema = z.enum(["monthly", "quarterly", "trailing_12_month"]);
export const MetricAggregationGrainSchema = z.enum(["county", "market", "state", "country"]);
export const MetricNullHandlingSchema = z.enum(["exclude", "coalesce_zero", "error"]);

export const MarketMetricDefinitionSchema = z.object({
  key: MarketMetricKeySchema,
  canonicalFormula: z.string().min(1),
  timeWindow: MetricTimeWindowSchema,
  aggregationGrain: MetricAggregationGrainSchema,
  nullHandling: MetricNullHandlingSchema,
  owner: z.string().min(1),
  dueDate: z.string().date(),
});

export const MarketMetricDefinitionsSchema = z.object({
  market_size: MarketMetricDefinitionSchema.extend({
    key: z.literal("market_size"),
  }),
  absorption: MarketMetricDefinitionSchema.extend({
    key: z.literal("absorption"),
  }),
  vacancy: MarketMetricDefinitionSchema.extend({
    key: z.literal("vacancy"),
  }),
});

export type MarketMetricKey = z.infer<typeof MarketMetricKeySchema>;
export type MetricTimeWindow = z.infer<typeof MetricTimeWindowSchema>;
export type MetricAggregationGrain = z.infer<typeof MetricAggregationGrainSchema>;
export type MetricNullHandling = z.infer<typeof MetricNullHandlingSchema>;
export type MarketMetricDefinition = z.infer<typeof MarketMetricDefinitionSchema>;
export type MarketMetricDefinitions = z.infer<typeof MarketMetricDefinitionsSchema>;
