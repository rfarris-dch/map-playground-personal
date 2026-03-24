import type {
  CountyChange,
  CountyScore,
} from "@map-migration/http-contracts/county-intelligence-http";
import type {
  CountyPowerStoryGeometryFeature,
  CountyPowerStoryId,
  CountyPowerStoryRow,
  CountyPowerStoryTimelineFrame,
  CountyPowerStoryWindow,
} from "@map-migration/http-contracts/county-power-story-http";
import type { CountyScoreRow } from "@/geo/county-intelligence/county-intelligence.repo.types";
import { queryCountyScoresStatus } from "@/geo/county-intelligence/county-intelligence.service";
import {
  mapCountyPowerStoryGeometryRow,
  mapCountyPowerStoryRow,
  mapCountyPowerStorySourceRow,
  mapCountyPowerStoryTimelineFrameRow,
} from "./county-power-story.mapper";
import {
  type CountyPowerStoryGeometryRow,
  type CountyPowerStoryPublicationRow,
  getCountyPowerStoryPublication,
  getCountyPowerStoryVectorTile,
  listCountyPowerStoryGeometry,
  listCountyPowerStorySnapshotRowsByPublication,
} from "./county-power-story.repo";

type CountyPowerStoryFailureReason =
  | "mapping_failed"
  | "publication_run_not_found"
  | "query_failed"
  | "source_unavailable";

interface CountyPowerStoryFailure {
  readonly error: unknown;
  readonly reason: CountyPowerStoryFailureReason;
}

interface CountyPowerStorySnapshotValue {
  readonly dataVersion: string | null;
  readonly formulaVersion: string | null;
  readonly inputDataVersion: string | null;
  readonly publicationRunId: string | null;
  readonly publishedAt: string | null;
  readonly rows: readonly CountyPowerStoryRow[];
  readonly storyId: CountyPowerStoryId;
  readonly window: CountyPowerStoryWindow;
}

interface CountyPowerStoryTimelineValue {
  readonly dataVersion: string | null;
  readonly formulaVersion: string | null;
  readonly frames: readonly CountyPowerStoryTimelineFrame[];
  readonly inputDataVersion: string | null;
  readonly publicationRunId: string | null;
  readonly publishedAt: string | null;
  readonly storyId: CountyPowerStoryId;
}

type CountyPowerStoryGeometryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly features: readonly CountyPowerStoryGeometryFeature[];
      };
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    };

type CountyPowerStorySnapshotResult =
  | {
      readonly ok: true;
      readonly value: CountyPowerStorySnapshotValue;
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    };

type CountyPowerStoryTimelineResult =
  | {
      readonly ok: true;
      readonly value: CountyPowerStoryTimelineValue;
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    };

type CountyPowerStoryVectorTileResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly tile: Uint8Array;
      };
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    };

const COUNTY_POWER_STORY_RELATION_NAMES: readonly string[] = [
  "analytics.dim_county",
  "analytics.fact_market_analysis_score_snapshot",
  "analytics.fact_publication",
  "serve.boundary_county_geom_lod1",
];

const GRID_STRESS_KEYWORDS: readonly string[] = [
  "congest",
  "constraint",
  "grid",
  "shadow",
  "price",
  "upgrade",
  "friction",
  "rt",
];
const QUEUE_PRESSURE_KEYWORDS: readonly string[] = [
  "queue",
  "interconnection",
  "supply",
  "solar",
  "storage",
  "wind",
  "withdraw",
  "online",
  "ia",
];
const MARKET_STRUCTURE_KEYWORDS: readonly string[] = [
  "market",
  "retail",
  "utility",
  "choice",
  "operator",
  "authority",
  "zone",
  "seam",
];
const POLICY_WATCH_KEYWORDS: readonly string[] = [
  "policy",
  "moratorium",
  "sentiment",
  "permit",
  "ordinance",
  "zoning",
  "public",
  "watch",
];

function storyKeywords(storyId: CountyPowerStoryId): readonly string[] {
  if (storyId === "grid-stress") {
    return GRID_STRESS_KEYWORDS;
  }

  if (storyId === "queue-pressure") {
    return QUEUE_PRESSURE_KEYWORDS;
  }

  if (storyId === "market-structure") {
    return MARKET_STRUCTURE_KEYWORDS;
  }

  return POLICY_WATCH_KEYWORDS;
}

function clampUnit(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function safeNumber(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return value;
}

function normalizeSeries(values: readonly number[]): readonly number[] {
  if (values.length === 0) {
    return [];
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const value of values) {
    if (value < min) {
      min = value;
    }
    if (value > max) {
      max = value;
    }
  }

  if (!(Number.isFinite(min) && Number.isFinite(max))) {
    return values.map(() => 0);
  }

  const range = max - min;
  if (range <= 1e-9) {
    return values.map((value) => (value > 0 ? 1 : 0));
  }

  return values.map((value) => clampUnit((value - min) / range));
}

function toBand(normalizedScore: number): CountyPowerStoryRow["band"] {
  if (normalizedScore >= 0.8) {
    return "extreme";
  }

  if (normalizedScore >= 0.58) {
    return "high";
  }

  if (normalizedScore >= 0.32) {
    return "elevated";
  }

  return "baseline";
}

function buildSeed(countyFips: string): number {
  let accumulator = 0;
  for (const character of countyFips) {
    accumulator = (accumulator * 31 + character.charCodeAt(0)) % 997;
  }

  return accumulator / 997;
}

function changeText(change: CountyChange): string {
  return `${change.code} ${change.label} ${change.summary}`.toLowerCase();
}

function windowChanges(
  score: CountyScore,
  window: CountyPowerStoryWindow
): readonly CountyChange[] {
  if (window === "30d") {
    return score.whatChanged30d;
  }

  if (window === "60d") {
    return score.whatChanged60d;
  }

  if (window === "90d") {
    return score.whatChanged90d;
  }

  return score.whatChanged30d;
}

function relevantChanges(
  score: CountyScore,
  storyId: CountyPowerStoryId,
  window: CountyPowerStoryWindow
): readonly CountyChange[] {
  const changes = windowChanges(score, window);
  if (changes.length === 0) {
    return changes;
  }

  const keywords = storyKeywords(storyId);
  const matchingChanges = changes.filter((change) =>
    keywords.some((keyword) => changeText(change).includes(keyword))
  );

  return matchingChanges.length > 0 ? matchingChanges : changes;
}

function divisorForWindow(window: CountyPowerStoryWindow): number {
  if (window === "30d") {
    return 2;
  }

  if (window === "60d") {
    return 3;
  }

  if (window === "90d") {
    return 4;
  }

  return 2;
}

function changeSignal(
  score: CountyScore,
  storyId: CountyPowerStoryId,
  window: CountyPowerStoryWindow
): number {
  const changes = relevantChanges(score, storyId, window);
  if (changes.length === 0) {
    return 0;
  }

  const directionalWeight = changes.reduce((total, change) => {
    if (change.direction === "flat") {
      return total + 0.25;
    }

    return total + 1;
  }, 0);

  return clampUnit(directionalWeight / divisorForWindow(window));
}

function liveDirection(
  score: CountyScore,
  storyId: CountyPowerStoryId
): CountyPowerStoryRow["direction"] {
  if (storyId === "grid-stress") {
    const congestionComponent = safeNumber(score.avgRtCongestionComponent);
    if (congestionComponent < -1e-6) {
      return "cool";
    }

    if (congestionComponent > 1e-6) {
      return "warm";
    }

    return "neutral";
  }

  if (storyId === "queue-pressure") {
    const queueStress = safeNumber(score.queueMwActive) + safeNumber(score.queueProjectCountActive);
    if (queueStress <= 0) {
      return "neutral";
    }

    return safeNumber(score.queueWithdrawalRate) >= 0.25 ? "mixed" : "warm";
  }

  if (storyId === "market-structure") {
    return score.isSeamCounty ? "mixed" : "neutral";
  }

  if (score.moratoriumStatus === "active" || score.moratoriumStatus === "watch") {
    return "watch";
  }

  return "neutral";
}

function windowDirection(
  score: CountyScore,
  storyId: CountyPowerStoryId,
  window: CountyPowerStoryWindow
): CountyPowerStoryRow["direction"] {
  if (window === "live") {
    return liveDirection(score, storyId);
  }

  const changes = relevantChanges(score, storyId, window);
  const upCount = changes.filter((change) => change.direction === "up").length;
  const downCount = changes.filter((change) => change.direction === "down").length;

  if (upCount === downCount) {
    return liveDirection(score, storyId);
  }

  if (storyId === "grid-stress") {
    return upCount > downCount ? "warm" : "cool";
  }

  if (storyId === "policy-watch") {
    return upCount > downCount ? "watch" : "neutral";
  }

  if (storyId === "market-structure") {
    return "mixed";
  }

  return upCount > downCount ? "warm" : "neutral";
}

function queueCategory(score: CountyScore): string | null {
  const solarMw = safeNumber(score.queueSolarMw);
  const storageMw = safeNumber(score.queueStorageMw);
  const windMw = safeNumber(score.queueWindMw);
  const totalMw = solarMw + storageMw + windMw;

  if (totalMw <= 0) {
    return null;
  }

  const solarShare = solarMw / totalMw;
  const storageShare = storageMw / totalMw;
  const windShare = windMw / totalMw;

  if (solarShare >= 0.55) {
    return "solar";
  }

  if (storageShare >= 0.55) {
    return "storage";
  }

  if (windShare >= 0.55) {
    return "wind";
  }

  return "mixed";
}

function categoryKey(score: CountyScore, storyId: CountyPowerStoryId): string | null {
  if (storyId === "grid-stress") {
    return liveDirection(score, storyId);
  }

  if (storyId === "queue-pressure") {
    return queueCategory(score);
  }

  if (storyId === "market-structure") {
    return score.powerMarketContext.marketStructure;
  }

  return score.moratoriumStatus;
}

function marketStructureBaseScore(score: CountyScore): number {
  let scoreValue = 20;

  if (score.powerMarketContext.marketStructure === "mixed") {
    scoreValue += 30;
  } else if (score.powerMarketContext.marketStructure === "organized_market") {
    scoreValue += 18;
  } else if (score.powerMarketContext.marketStructure === "traditional_vertical") {
    scoreValue += 14;
  }

  if (score.retailStructure.retailChoiceStatus === "mixed") {
    scoreValue += 18;
  } else if (score.retailStructure.retailChoiceStatus === "partial_choice") {
    scoreValue += 12;
  } else if (score.retailStructure.retailChoiceStatus === "choice") {
    scoreValue += 8;
  }

  if (score.isSeamCounty) {
    scoreValue += 32;
  }

  return scoreValue;
}

function marketStructureOutlineScore(score: CountyScore): number {
  let outlineScore = score.isSeamCounty ? 1 : 0;

  if (score.retailStructure.retailChoiceStatus === "mixed") {
    outlineScore += 0.8;
  } else if (score.retailStructure.retailChoiceStatus === "partial_choice") {
    outlineScore += 0.55;
  } else if (score.retailStructure.retailChoiceStatus === "choice") {
    outlineScore += 0.35;
  }

  return outlineScore;
}

function policyBaseScore(score: CountyScore): number {
  let scoreValue = 0;

  if (score.moratoriumStatus === "active") {
    scoreValue += 100;
  } else if (score.moratoriumStatus === "watch") {
    scoreValue += 70;
  } else if (score.moratoriumStatus === "none") {
    scoreValue += 18;
  } else {
    scoreValue += 10;
  }

  scoreValue += Math.abs(safeNumber(score.policyMomentumScore)) * 2.5;
  scoreValue += Math.abs(safeNumber(score.publicSentimentScore)) * 25;
  scoreValue += safeNumber(score.policyEventCount) * 8;
  scoreValue += safeNumber(score.countyTaggedEventShare) * 60;

  return scoreValue;
}

function policyOutlineScore(score: CountyScore): number {
  let outlineScore =
    safeNumber(score.policyEventCount) + safeNumber(score.countyTaggedEventShare) * 4;

  if (score.moratoriumStatus === "active") {
    outlineScore += 6;
  } else if (score.moratoriumStatus === "watch") {
    outlineScore += 3;
  }

  return outlineScore;
}

function liveBaseScore(score: CountyScore, storyId: CountyPowerStoryId): number {
  if (storyId === "grid-stress") {
    return (
      Math.abs(safeNumber(score.avgRtCongestionComponent)) * 0.6 +
      safeNumber(score.congestionProxyScore) * 0.35 +
      safeNumber(score.p95ShadowPrice) * 0.05 +
      safeNumber(score.negativePriceHourShare) * 50
    );
  }

  if (storyId === "queue-pressure") {
    return (
      Math.log1p(safeNumber(score.queueMwActive)) * 6 +
      safeNumber(score.queueProjectCountActive) * 1.5 +
      Math.log1p(safeNumber(score.queueAvgAgeDays)) * 2 +
      safeNumber(score.plannedUpgradeCount) * 0.7 +
      Math.log1p(safeNumber(score.recentOnlineMw)) * 0.8
    );
  }

  if (storyId === "market-structure") {
    return marketStructureBaseScore(score);
  }

  return policyBaseScore(score);
}

function liveOutlineScore(score: CountyScore, storyId: CountyPowerStoryId): number {
  if (storyId === "grid-stress") {
    return safeNumber(score.p95ShadowPrice) + safeNumber(score.negativePriceHourShare) * 100;
  }

  if (storyId === "queue-pressure") {
    return (
      Math.log1p(safeNumber(score.queueMwActive)) * 2 +
      safeNumber(score.plannedUpgradeCount) +
      Math.log1p(safeNumber(score.recentOnlineMw))
    );
  }

  if (storyId === "market-structure") {
    return marketStructureOutlineScore(score);
  }

  return policyOutlineScore(score);
}

function compareStoryRows(left: CountyPowerStoryRow, right: CountyPowerStoryRow): number {
  return left.countyFips.localeCompare(right.countyFips);
}

function sourceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (!normalizedMessage.includes("does not exist")) {
    return false;
  }

  return COUNTY_POWER_STORY_RELATION_NAMES.some((relationName) =>
    error.message.includes(relationName)
  );
}

function publicationMismatchFailure(publicationRunId: string): CountyPowerStoryFailure {
  return {
    reason: "publication_run_not_found",
    error: new Error(`county power story publication not found: ${publicationRunId}`),
  };
}

function latestPublicationUnavailableFailure(): CountyPowerStoryFailure {
  return {
    reason: "source_unavailable",
    error: new Error("county power story publication is unavailable"),
  };
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNullableIsoDateTime(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("invalid published_at");
    }

    return value.toISOString();
  }

  const normalized = readNullableText(value);
  if (normalized === null) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("invalid published_at");
  }

  return parsed.toISOString();
}

interface CountyPowerStoryPublicationDetails {
  readonly dataVersion: string | null;
  readonly formulaVersion: string | null;
  readonly inputDataVersion: string | null;
  readonly publicationRunId: string;
  readonly publishedAt: string | null;
}

function mapPublicationDetails(row: {
  readonly data_version: string | null | undefined;
  readonly formula_version: string | null | undefined;
  readonly input_data_version: string | null | undefined;
  readonly publication_run_id: string | null | undefined;
  readonly published_at: Date | string | null | undefined;
}): CountyPowerStoryPublicationDetails {
  const publicationRunId = readNullableText(row.publication_run_id);
  if (publicationRunId === null) {
    throw new Error("invalid publication_run_id");
  }

  return {
    dataVersion: readNullableText(row.data_version),
    formulaVersion: readNullableText(row.formula_version),
    inputDataVersion: readNullableText(row.input_data_version),
    publicationRunId,
    publishedAt: readNullableIsoDateTime(row.published_at),
  };
}

async function resolveCountyPowerStoryPublication(args: {
  readonly publicationRunId?: string | undefined;
}): Promise<
  | {
      readonly ok: true;
      readonly value: CountyPowerStoryPublicationDetails;
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    }
> {
  if (typeof args.publicationRunId === "string") {
    let publicationRow: CountyPowerStoryPublicationRow | null;
    try {
      publicationRow = await getCountyPowerStoryPublication(args.publicationRunId);
    } catch (error) {
      return {
        ok: false,
        value: {
          reason: sourceUnavailable(error) ? "source_unavailable" : "query_failed",
          error,
        },
      };
    }

    if (publicationRow === null) {
      return {
        ok: false,
        value: publicationMismatchFailure(args.publicationRunId),
      };
    }

    try {
      return {
        ok: true,
        value: mapPublicationDetails(publicationRow),
      };
    } catch (error) {
      return {
        ok: false,
        value: {
          reason: "mapping_failed",
          error,
        },
      };
    }
  }

  const statusResult = await queryCountyScoresStatus();
  if (!statusResult.ok) {
    return statusResult;
  }

  if (statusResult.value.publicationRunId === null) {
    return {
      ok: false,
      value: latestPublicationUnavailableFailure(),
    };
  }

  return {
    ok: true,
    value: {
      dataVersion: statusResult.value.dataVersion,
      formulaVersion: statusResult.value.formulaVersion,
      inputDataVersion: statusResult.value.inputDataVersion,
      publicationRunId: statusResult.value.publicationRunId,
      publishedAt: statusResult.value.publishedAt,
    },
  };
}

function mapRowsToCountyScores(rows: readonly CountyScore[]): readonly CountyScore[] {
  return [...rows].sort((left, right) => left.countyFips.localeCompare(right.countyFips));
}

function buildStoryRows(
  scores: readonly CountyScore[],
  storyId: CountyPowerStoryId,
  window: CountyPowerStoryWindow
): readonly CountyPowerStoryRow[] {
  const liveBaseScores = scores.map((score) => liveBaseScore(score, storyId));
  const liveOutlineScores = scores.map((score) => liveOutlineScore(score, storyId));
  const normalizedLiveScores = normalizeSeries(liveBaseScores);
  const normalizedOutlineScores = normalizeSeries(liveOutlineScores);

  return scores
    .map((score, index) => {
      const liveNormalizedScore = normalizedLiveScores[index] ?? 0;
      const liveOutlineIntensity = normalizedOutlineScores[index] ?? 0;
      const activityWindow = window === "live" ? "30d" : window;
      const activityScore = changeSignal(score, storyId, activityWindow);
      const normalizedScore =
        window === "live"
          ? liveNormalizedScore
          : clampUnit(liveNormalizedScore * 0.35 + activityScore * 0.65);
      const outlineIntensity = clampUnit(liveOutlineIntensity * 0.7 + activityScore * 0.3);
      const pulseAmplitude = clampUnit(normalizedScore * 0.8 + activityScore * 0.2);

      return mapCountyPowerStoryRow({
        score,
        computed: {
          activityScore,
          band: toBand(normalizedScore),
          categoryKey: categoryKey(score, storyId),
          direction: windowDirection(score, storyId, window),
          normalizedScore,
          outlineIntensity,
          pulseAmplitude,
          seed: buildSeed(score.countyFips),
        },
      });
    })
    .sort(compareStoryRows);
}

async function readPublishedCountyScores(args: {
  readonly publicationRunId?: string | undefined;
}): Promise<
  | {
      readonly ok: true;
      readonly value: {
        readonly dataVersion: string | null;
        readonly formulaVersion: string | null;
        readonly inputDataVersion: string | null;
        readonly publicationRunId: string | null;
        readonly publishedAt: string | null;
        readonly scores: readonly CountyScore[];
      };
    }
  | {
      readonly ok: false;
      readonly value: CountyPowerStoryFailure;
    }
> {
  const publicationResult = await resolveCountyPowerStoryPublication(args);
  if (!publicationResult.ok) {
    return publicationResult;
  }

  let rows: CountyScoreRow[];
  try {
    rows = await listCountyPowerStorySnapshotRowsByPublication(
      publicationResult.value.publicationRunId
    );
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: sourceUnavailable(error) ? "source_unavailable" : "query_failed",
        error,
      },
    };
  }

  try {
    const scores = mapRowsToCountyScores(rows.map((row) => mapCountyPowerStorySourceRow(row)));

    return {
      ok: true,
      value: {
        dataVersion: publicationResult.value.dataVersion,
        formulaVersion: publicationResult.value.formulaVersion,
        inputDataVersion: publicationResult.value.inputDataVersion,
        publicationRunId: publicationResult.value.publicationRunId,
        publishedAt: publicationResult.value.publishedAt,
        scores,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}

export async function queryCountyPowerStoryGeometry(): Promise<CountyPowerStoryGeometryResult> {
  let rows: CountyPowerStoryGeometryRow[];
  try {
    rows = await listCountyPowerStoryGeometry();
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: sourceUnavailable(error) ? "source_unavailable" : "query_failed",
        error,
      },
    };
  }

  try {
    return {
      ok: true,
      value: {
        features: rows.map((row) => mapCountyPowerStoryGeometryRow(row)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}

export async function queryCountyPowerStoryVectorTile(args: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): Promise<CountyPowerStoryVectorTileResult> {
  try {
    return {
      ok: true,
      value: {
        tile: await getCountyPowerStoryVectorTile(args),
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: sourceUnavailable(error) ? "source_unavailable" : "query_failed",
        error,
      },
    };
  }
}

export async function queryCountyPowerStorySnapshot(args: {
  readonly publicationRunId?: string | undefined;
  readonly storyId: CountyPowerStoryId;
  readonly window: CountyPowerStoryWindow;
}): Promise<CountyPowerStorySnapshotResult> {
  const publishedScoresResult = await readPublishedCountyScores({
    publicationRunId: args.publicationRunId,
  });
  if (!publishedScoresResult.ok) {
    return publishedScoresResult;
  }

  try {
    return {
      ok: true,
      value: {
        dataVersion: publishedScoresResult.value.dataVersion,
        formulaVersion: publishedScoresResult.value.formulaVersion,
        inputDataVersion: publishedScoresResult.value.inputDataVersion,
        publicationRunId: publishedScoresResult.value.publicationRunId,
        publishedAt: publishedScoresResult.value.publishedAt,
        rows: buildStoryRows(publishedScoresResult.value.scores, args.storyId, args.window),
        storyId: args.storyId,
        window: args.window,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}

export async function queryCountyPowerStoryTimeline(args: {
  readonly publicationRunId?: string | undefined;
  readonly storyId: CountyPowerStoryId;
}): Promise<CountyPowerStoryTimelineResult> {
  const publishedScoresResult = await readPublishedCountyScores({
    publicationRunId: args.publicationRunId,
  });
  if (!publishedScoresResult.ok) {
    return publishedScoresResult;
  }

  try {
    const frameWindows: readonly CountyPowerStoryWindow[] = ["live", "30d", "60d", "90d"];
    const frames = frameWindows.map((window) => ({
      window,
      rows: buildStoryRows(publishedScoresResult.value.scores, args.storyId, window).map((row) =>
        mapCountyPowerStoryTimelineFrameRow(row)
      ),
    }));

    return {
      ok: true,
      value: {
        dataVersion: publishedScoresResult.value.dataVersion,
        formulaVersion: publishedScoresResult.value.formulaVersion,
        inputDataVersion: publishedScoresResult.value.inputDataVersion,
        publicationRunId: publishedScoresResult.value.publicationRunId,
        publishedAt: publishedScoresResult.value.publishedAt,
        frames,
        storyId: args.storyId,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }
}
