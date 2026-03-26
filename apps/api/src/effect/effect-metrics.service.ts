import { Metric, MetricState } from "effect";
import { describeEffectDevToolsConnection } from "@/effect/api-effect-runtime";
import {
  type EffectFailureEvent,
  getRecentEffectFailures,
} from "@/effect/effect-failure-trail.service";

interface EffectMetricTag {
  readonly key: string;
  readonly value: string;
}

interface EffectCounterMetricSnapshot {
  readonly description: string | null;
  readonly kind: "counter";
  readonly name: string;
  readonly tags: readonly EffectMetricTag[];
  readonly value: number | string;
}

interface EffectFrequencyMetricSnapshot {
  readonly description: string | null;
  readonly kind: "frequency";
  readonly name: string;
  readonly occurrences: Readonly<Record<string, number>>;
  readonly tags: readonly EffectMetricTag[];
}

interface EffectGaugeMetricSnapshot {
  readonly description: string | null;
  readonly kind: "gauge";
  readonly name: string;
  readonly tags: readonly EffectMetricTag[];
  readonly value: number | string;
}

interface EffectHistogramBucketSnapshot {
  readonly count: number;
  readonly upperBound: number | null;
}

interface EffectHistogramMetricSnapshot {
  readonly buckets: readonly EffectHistogramBucketSnapshot[];
  readonly count: number;
  readonly description: string | null;
  readonly kind: "histogram";
  readonly max: number;
  readonly min: number;
  readonly name: string;
  readonly sum: number;
  readonly tags: readonly EffectMetricTag[];
}

interface EffectSummaryQuantileSnapshot {
  readonly quantile: number;
  readonly value: number | null;
}

interface EffectSummaryMetricSnapshot {
  readonly count: number;
  readonly description: string | null;
  readonly error: number;
  readonly kind: "summary";
  readonly max: number;
  readonly min: number;
  readonly name: string;
  readonly quantiles: readonly EffectSummaryQuantileSnapshot[];
  readonly sum: number;
  readonly tags: readonly EffectMetricTag[];
}

type EffectMetricSnapshot =
  | EffectCounterMetricSnapshot
  | EffectFrequencyMetricSnapshot
  | EffectGaugeMetricSnapshot
  | EffectHistogramMetricSnapshot
  | EffectSummaryMetricSnapshot;

interface EffectIssueSnapshot {
  readonly description: string | null;
  readonly metricKind: EffectMetricSnapshot["kind"];
  readonly name: string;
  readonly severity: "error";
  readonly tags: readonly EffectMetricTag[];
  readonly value: number | string;
}

interface EffectIssuesSnapshot {
  readonly devToolsConnection: string | null;
  readonly generatedAt: string;
  readonly issueCount: number;
  readonly issues: readonly EffectIssueSnapshot[];
  readonly metrics: readonly EffectMetricSnapshot[];
  readonly recentFailures: readonly EffectFailureEvent[];
  readonly spotlight: {
    readonly fiberActive: number | string | null;
    readonly fiberFailures: number | string | null;
    readonly fiberStarted: number | string | null;
    readonly fiberSuccesses: number | string | null;
  };
  readonly status: "ok";
}

const EFFECT_METRIC_PREFIX = "effect_";
const ISSUE_NAME_PATTERN = /(defect|error|failure|failures|interrupt)/i;

function normalizeMetricNumber(value: number | bigint): number | string {
  return typeof value === "bigint" ? value.toString() : value;
}

function isMetricValuePositive(value: number | bigint): boolean {
  if (typeof value === "bigint") {
    return value > 0n;
  }

  return Number.isFinite(value) && value > 0;
}

function readDescription(description: unknown): string | null {
  if (typeof description === "string") {
    return description;
  }

  if (typeof description !== "object" || description === null) {
    return null;
  }

  if (Reflect.get(description, "_tag") !== "Some") {
    return null;
  }

  const value = Reflect.get(description, "value");
  return typeof value === "string" ? value : null;
}

function normalizeTags(tags: readonly { readonly key: string; readonly value: string }[]) {
  return tags.map((tag) => ({
    key: tag.key,
    value: tag.value,
  }));
}

function normalizeFrequencyOccurrences(
  occurrences: ReadonlyMap<string, number>
): Readonly<Record<string, number>> {
  return Object.fromEntries(occurrences.entries());
}

function normalizeHistogramBuckets(
  buckets: readonly (readonly [number, number])[]
): readonly EffectHistogramBucketSnapshot[] {
  return buckets.map(([upperBound, count]) => ({
    count,
    upperBound: Number.isFinite(upperBound) ? upperBound : null,
  }));
}

function normalizeSummaryQuantiles(
  quantiles: readonly (readonly [number, { readonly _tag: string; readonly value?: number }])[]
): readonly EffectSummaryQuantileSnapshot[] {
  return quantiles.map(([quantile, value]) => ({
    quantile,
    value: value._tag === "Some" && typeof value.value === "number" ? value.value : null,
  }));
}

function toEffectMetricSnapshot(): readonly EffectMetricSnapshot[] {
  const metrics: EffectMetricSnapshot[] = [];

  for (const pair of Metric.unsafeSnapshot()) {
    if (!pair.metricKey.name.startsWith(EFFECT_METRIC_PREFIX)) {
      continue;
    }

    const base = {
      description: readDescription(pair.metricKey.description),
      name: pair.metricKey.name,
      tags: normalizeTags(pair.metricKey.tags),
    };

    if (MetricState.isCounterState(pair.metricState)) {
      metrics.push({
        ...base,
        kind: "counter",
        value: normalizeMetricNumber(pair.metricState.count),
      });
      continue;
    }

    if (MetricState.isGaugeState(pair.metricState)) {
      metrics.push({
        ...base,
        kind: "gauge",
        value: normalizeMetricNumber(pair.metricState.value),
      });
      continue;
    }

    if (MetricState.isFrequencyState(pair.metricState)) {
      metrics.push({
        ...base,
        kind: "frequency",
        occurrences: normalizeFrequencyOccurrences(pair.metricState.occurrences),
      });
      continue;
    }

    if (MetricState.isHistogramState(pair.metricState)) {
      metrics.push({
        ...base,
        buckets: normalizeHistogramBuckets(pair.metricState.buckets),
        count: pair.metricState.count,
        kind: "histogram",
        max: pair.metricState.max,
        min: pair.metricState.min,
        sum: pair.metricState.sum,
      });
      continue;
    }

    if (MetricState.isSummaryState(pair.metricState)) {
      metrics.push({
        ...base,
        count: pair.metricState.count,
        error: pair.metricState.error,
        kind: "summary",
        max: pair.metricState.max,
        min: pair.metricState.min,
        quantiles: normalizeSummaryQuantiles(pair.metricState.quantiles),
        sum: pair.metricState.sum,
      });
    }
  }

  metrics.sort((left, right) => left.name.localeCompare(right.name));
  return metrics;
}

function findIssueSnapshots(
  metrics: readonly EffectMetricSnapshot[]
): readonly EffectIssueSnapshot[] {
  const issues: EffectIssueSnapshot[] = [];

  for (const metric of metrics) {
    if (!ISSUE_NAME_PATTERN.test(metric.name)) {
      continue;
    }

    if (
      (metric.kind === "counter" || metric.kind === "gauge") &&
      typeof metric.value !== "undefined" &&
      isMetricValuePositive(typeof metric.value === "string" ? BigInt(metric.value) : metric.value)
    ) {
      issues.push({
        description: metric.description,
        metricKind: metric.kind,
        name: metric.name,
        severity: "error",
        tags: metric.tags,
        value: metric.value,
      });
    }
  }

  return issues;
}

function readSpotlightValue(
  metrics: readonly EffectMetricSnapshot[],
  name: string
): number | string | null {
  const metric = metrics.find((candidate) => candidate.name === name);
  if (typeof metric === "undefined") {
    return null;
  }

  if (metric.kind === "counter" || metric.kind === "gauge") {
    return metric.value;
  }

  return null;
}

export function getEffectIssuesSnapshot(): EffectIssuesSnapshot {
  const metrics = toEffectMetricSnapshot();
  const issues = findIssueSnapshots(metrics);

  return {
    devToolsConnection: describeEffectDevToolsConnection(),
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
    metrics,
    recentFailures: getRecentEffectFailures(),
    spotlight: {
      fiberActive: readSpotlightValue(metrics, "effect_fiber_active"),
      fiberFailures: readSpotlightValue(metrics, "effect_fiber_failures"),
      fiberStarted: readSpotlightValue(metrics, "effect_fiber_started"),
      fiberSuccesses: readSpotlightValue(metrics, "effect_fiber_successes"),
    },
    status: "ok",
  };
}
