import { GeometrySchema } from "@map-migration/geo-kernel/geometry";
import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";
import type {
  CountyPowerStoryBand,
  CountyPowerStoryGeometryFeature,
  CountyPowerStoryRow,
  CountyPowerStoryTimelineFrameRow,
} from "@map-migration/http-contracts/county-power-story-http";
import { mapCountyScoreRow } from "@/geo/county-intelligence/county-intelligence.mapper";
import type { CountyScoreRow } from "@/geo/county-intelligence/county-intelligence.repo.types";
import type { CountyPowerStoryGeometryRow } from "./county-power-story.repo";

export interface CountyPowerStoryComputedMetrics {
  readonly activityScore: number;
  readonly band: CountyPowerStoryBand;
  readonly categoryKey: string | null;
  readonly direction: CountyPowerStoryRow["direction"];
  readonly normalizedScore: number;
  readonly outlineIntensity: number;
  readonly pulseAmplitude: number;
  readonly seed: number;
}

function parseJsonObject(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid county power story geometry: not valid JSON");
  }
}

function readGeometry(input: unknown): CountyPowerStoryGeometryFeature["geometry"] {
  const value = typeof input === "string" ? parseJsonObject(input) : input;
  const parsed = GeometrySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid county power story geometry: geometry did not match GeoJSON schema");
  }

  return parsed.data;
}

function readRequiredText(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid county power story row: missing ${fieldName}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Invalid county power story row: missing ${fieldName}`);
  }

  return normalized;
}

function readOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readFiniteNumber(value: number | string | null | undefined, fieldName: string): number {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(`Invalid county power story row: ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`Invalid county power story row: ${fieldName}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Invalid county power story row: ${fieldName}`);
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid county power story row: ${fieldName}`);
  }

  return parsed;
}

export function mapCountyPowerStoryGeometryRow(
  row: CountyPowerStoryGeometryRow
): CountyPowerStoryGeometryFeature {
  return {
    type: "Feature",
    id: readRequiredText(row.county_fips, "county_fips"),
    geometry: readGeometry(row.geom_json),
    properties: {
      countyFips: readRequiredText(row.county_fips, "county_fips"),
      countyName: readOptionalText(row.county_name),
      stateAbbrev: readOptionalText(row.state_abbrev),
      centroid: [
        readFiniteNumber(row.centroid_lng, "centroid_lng"),
        readFiniteNumber(row.centroid_lat, "centroid_lat"),
      ],
    },
  };
}

export function mapCountyPowerStorySourceRow(row: CountyScoreRow): CountyScore {
  return mapCountyScoreRow(row);
}

export function mapCountyPowerStoryRow(args: {
  readonly computed: CountyPowerStoryComputedMetrics;
  readonly score: CountyScore;
}): CountyPowerStoryRow {
  return {
    countyFips: args.score.countyFips,
    countyName: args.score.countyName,
    stateAbbrev: args.score.stateAbbrev,
    avgRtCongestionComponent: args.score.avgRtCongestionComponent,
    isSeamCounty: args.score.isSeamCounty,
    marketStructure: args.score.powerMarketContext.marketStructure,
    moratoriumStatus: args.score.moratoriumStatus,
    negativePriceHourShare: args.score.negativePriceHourShare,
    p95ShadowPrice: args.score.p95ShadowPrice,
    policyEventCount: args.score.policyEventCount,
    policyMomentumScore: args.score.policyMomentumScore,
    queueAvgAgeDays: args.score.queueAvgAgeDays,
    queueMwActive: args.score.queueMwActive,
    queueProjectCountActive: args.score.queueProjectCountActive,
    wholesaleOperator: args.score.powerMarketContext.wholesaleOperator,
    transmissionMiles345kvPlus: args.score.transmissionMiles345kvPlus,
    transmissionMiles500kvPlus: args.score.transmissionMiles500kvPlus,
    transmissionMiles765kvPlus: args.score.transmissionMiles765kvPlus,
    activityScore: args.computed.activityScore,
    band: args.computed.band,
    categoryKey: args.computed.categoryKey,
    direction: args.computed.direction,
    normalizedScore: args.computed.normalizedScore,
    outlineIntensity: args.computed.outlineIntensity,
    pulseAmplitude: args.computed.pulseAmplitude,
    seed: args.computed.seed,
  };
}

export function mapCountyPowerStoryTimelineFrameRow(
  row: CountyPowerStoryRow
): CountyPowerStoryTimelineFrameRow {
  return {
    countyFips: row.countyFips,
    activityScore: row.activityScore,
    band: row.band,
    categoryKey: row.categoryKey,
    direction: row.direction,
    normalizedScore: row.normalizedScore,
    outlineIntensity: row.outlineIntensity,
    pulseAmplitude: row.pulseAmplitude,
    seed: row.seed,
  };
}
