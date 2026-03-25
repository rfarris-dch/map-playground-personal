import { z } from "zod";

const EffectMetricValueSchema = z.union([z.number(), z.string()]);

export const EffectMetricTagSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export const EffectCounterMetricSnapshotSchema = z.object({
  description: z.string().nullable(),
  kind: z.literal("counter"),
  name: z.string().min(1),
  tags: z.array(EffectMetricTagSchema),
  value: EffectMetricValueSchema,
});

export const EffectFrequencyMetricSnapshotSchema = z.object({
  description: z.string().nullable(),
  kind: z.literal("frequency"),
  name: z.string().min(1),
  occurrences: z.record(z.string(), z.number().int().nonnegative()),
  tags: z.array(EffectMetricTagSchema),
});

export const EffectGaugeMetricSnapshotSchema = z.object({
  description: z.string().nullable(),
  kind: z.literal("gauge"),
  name: z.string().min(1),
  tags: z.array(EffectMetricTagSchema),
  value: EffectMetricValueSchema,
});

export const EffectHistogramBucketSnapshotSchema = z.object({
  count: z.number().int().nonnegative(),
  upperBound: z.number().finite().nullable(),
});

export const EffectHistogramMetricSnapshotSchema = z.object({
  buckets: z.array(EffectHistogramBucketSnapshotSchema),
  count: z.number().int().nonnegative(),
  description: z.string().nullable(),
  kind: z.literal("histogram"),
  max: z.number().finite(),
  min: z.number().finite(),
  name: z.string().min(1),
  sum: z.number().finite(),
  tags: z.array(EffectMetricTagSchema),
});

export const EffectSummaryQuantileSnapshotSchema = z.object({
  quantile: z.number().finite(),
  value: z.number().finite().nullable(),
});

export const EffectSummaryMetricSnapshotSchema = z.object({
  count: z.number().int().nonnegative(),
  description: z.string().nullable(),
  error: z.number().finite(),
  kind: z.literal("summary"),
  max: z.number().finite(),
  min: z.number().finite(),
  name: z.string().min(1),
  quantiles: z.array(EffectSummaryQuantileSnapshotSchema),
  sum: z.number().finite(),
  tags: z.array(EffectMetricTagSchema),
});

export const EffectMetricSnapshotSchema = z.union([
  EffectCounterMetricSnapshotSchema,
  EffectFrequencyMetricSnapshotSchema,
  EffectGaugeMetricSnapshotSchema,
  EffectHistogramMetricSnapshotSchema,
  EffectSummaryMetricSnapshotSchema,
]);

export const EffectIssueSnapshotSchema = z.object({
  description: z.string().nullable(),
  metricKind: z.enum(["counter", "frequency", "gauge", "histogram", "summary"]),
  name: z.string().min(1),
  severity: z.literal("error"),
  tags: z.array(EffectMetricTagSchema),
  value: EffectMetricValueSchema,
});

export const EffectFailureEventSchema = z.object({
  cause: z.string().min(1),
  code: z.string().min(1),
  details: z.unknown().optional(),
  fiberId: z.number().int().optional(),
  fiberThreadName: z.string().min(1).optional(),
  httpStatus: z.number().int().optional(),
  message: z.string().min(1),
  method: z.string().min(1).optional(),
  occurredAt: z.string().datetime(),
  path: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  scope: z.enum(["route", "runtime"]),
  source: z.string().min(1),
});

export const EffectIssuesSnapshotSchema = z.object({
  devToolsConnection: z.string().nullable(),
  generatedAt: z.string().datetime(),
  issueCount: z.number().int().nonnegative(),
  issues: z.array(EffectIssueSnapshotSchema),
  metrics: z.array(EffectMetricSnapshotSchema),
  recentFailures: z.array(EffectFailureEventSchema),
  spotlight: z.object({
    fiberActive: EffectMetricValueSchema.nullable(),
    fiberFailures: EffectMetricValueSchema.nullable(),
    fiberStarted: EffectMetricValueSchema.nullable(),
    fiberSuccesses: EffectMetricValueSchema.nullable(),
  }),
  status: z.literal("ok"),
});

export type EffectIssuesSnapshot = z.infer<typeof EffectIssuesSnapshotSchema>;
