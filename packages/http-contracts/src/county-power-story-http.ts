import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import { z } from "zod";
import { ResponseMetaSchema } from "./api-response-meta.js";
import {
  CountyFipsSchema,
  CountyPowerMarketContextSchema,
  CountyScoreSchema,
} from "./county-intelligence-http.js";

export const COUNTY_POWER_STORY_TILE_SOURCE_LAYER = "county_power_story";
export const COUNTY_POWER_STORY_TILE_PROMOTE_ID = "county_fips";

function trimQueryValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const CountyPowerStoryIdSchema = z.enum([
  "grid-stress",
  "queue-pressure",
  "market-structure",
  "policy-watch",
]);

export const CountyPowerStoryWindowSchema = z.enum(["live", "30d", "60d", "90d"]);

export const CountyPowerStoryBandSchema = z.enum(["baseline", "elevated", "high", "extreme"]);

export const CountyPowerStoryDirectionSchema = z.enum([
  "cool",
  "warm",
  "mixed",
  "watch",
  "neutral",
]);

export const CountyPowerStoryRequestSchema = z.object({
  publicationRunId: z.preprocess(trimQueryValue, z.string().min(1).optional()),
  storyId: z.preprocess(trimQueryValue, CountyPowerStoryIdSchema),
  window: z.preprocess(trimQueryValue, CountyPowerStoryWindowSchema).default("live"),
});

export const CountyPowerStoryGeometryPropertiesSchema = CountyScoreSchema.pick({
  countyFips: true,
  countyName: true,
  stateAbbrev: true,
}).extend({
  centroid: z.tuple([z.number().finite(), z.number().finite()]),
});

export const CountyPowerStoryGeometryFeatureSchema = z.object({
  type: z.literal("Feature"),
  id: CountyFipsSchema,
  geometry: GeometrySchema,
  properties: CountyPowerStoryGeometryPropertiesSchema,
});

export const CountyPowerStoryGeometryResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(CountyPowerStoryGeometryFeatureSchema),
  meta: ResponseMetaSchema,
});

const CountyPowerStoryMetricFieldsSchema = CountyScoreSchema.pick({
  avgRtCongestionComponent: true,
  countyFips: true,
  countyName: true,
  isSeamCounty: true,
  moratoriumStatus: true,
  negativePriceHourShare: true,
  p95ShadowPrice: true,
  policyEventCount: true,
  policyMomentumScore: true,
  queueAvgAgeDays: true,
  queueMwActive: true,
  queueProjectCountActive: true,
  stateAbbrev: true,
  transmissionMiles345kvPlus: true,
  transmissionMiles500kvPlus: true,
  transmissionMiles765kvPlus: true,
}).extend({
  marketStructure: CountyPowerMarketContextSchema.shape.marketStructure,
  wholesaleOperator: CountyPowerMarketContextSchema.shape.wholesaleOperator,
});

export const CountyPowerStoryRowSchema = CountyPowerStoryMetricFieldsSchema.extend({
  activityScore: z.number().min(0).max(1),
  band: CountyPowerStoryBandSchema,
  categoryKey: z.string().min(1).nullable(),
  direction: CountyPowerStoryDirectionSchema,
  normalizedScore: z.number().min(0).max(1),
  outlineIntensity: z.number().min(0).max(1),
  pulseAmplitude: z.number().min(0).max(1),
  seed: z.number().finite(),
});

export const CountyPowerStorySnapshotResponseSchema = z.object({
  dataVersion: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1).nullable(),
  inputDataVersion: z.string().min(1).nullable(),
  meta: ResponseMetaSchema,
  publicationRunId: z.string().min(1).nullable(),
  publishedAt: z.string().datetime().nullable(),
  rows: z.array(CountyPowerStoryRowSchema),
  storyId: CountyPowerStoryIdSchema,
  window: CountyPowerStoryWindowSchema,
});

export const CountyPowerStoryTimelineFrameRowSchema = z.object({
  activityScore: z.number().min(0).max(1),
  band: CountyPowerStoryBandSchema,
  categoryKey: z.string().min(1).nullable(),
  countyFips: CountyFipsSchema,
  direction: CountyPowerStoryDirectionSchema,
  normalizedScore: z.number().min(0).max(1),
  outlineIntensity: z.number().min(0).max(1),
  pulseAmplitude: z.number().min(0).max(1),
  seed: z.number().finite(),
});

export const CountyPowerStoryTimelineFrameSchema = z.object({
  rows: z.array(CountyPowerStoryTimelineFrameRowSchema),
  window: CountyPowerStoryWindowSchema,
});

export const CountyPowerStoryTimelineResponseSchema = z.object({
  dataVersion: z.string().min(1).nullable(),
  formulaVersion: z.string().min(1).nullable(),
  frames: z.array(CountyPowerStoryTimelineFrameSchema),
  inputDataVersion: z.string().min(1).nullable(),
  meta: ResponseMetaSchema,
  publicationRunId: z.string().min(1).nullable(),
  publishedAt: z.string().datetime().nullable(),
  storyId: CountyPowerStoryIdSchema,
});

export type CountyPowerStoryBand = z.infer<typeof CountyPowerStoryBandSchema>;
export type CountyPowerStoryDirection = z.infer<typeof CountyPowerStoryDirectionSchema>;
export type CountyPowerStoryGeometryFeature = z.infer<typeof CountyPowerStoryGeometryFeatureSchema>;
export type CountyPowerStoryGeometryResponse = z.infer<
  typeof CountyPowerStoryGeometryResponseSchema
>;
export type CountyPowerStoryId = z.infer<typeof CountyPowerStoryIdSchema>;
export type CountyPowerStoryRequest = z.infer<typeof CountyPowerStoryRequestSchema>;
export type CountyPowerStoryRow = z.infer<typeof CountyPowerStoryRowSchema>;
export type CountyPowerStorySnapshotResponse = z.infer<
  typeof CountyPowerStorySnapshotResponseSchema
>;
export type CountyPowerStoryTimelineFrame = z.infer<typeof CountyPowerStoryTimelineFrameSchema>;
export type CountyPowerStoryTimelineFrameRow = z.infer<
  typeof CountyPowerStoryTimelineFrameRowSchema
>;
export type CountyPowerStoryTimelineResponse = z.infer<
  typeof CountyPowerStoryTimelineResponseSchema
>;
export type CountyPowerStoryWindow = z.infer<typeof CountyPowerStoryWindowSchema>;
