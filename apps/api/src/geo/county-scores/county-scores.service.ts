import type { CountyScore, CountyScoresStatusResponse } from "@map-migration/contracts";
import { mapCountyScoreRow } from "@/geo/county-scores/county-scores.mapper";
import type { CountyScoreRow, CountyScoresStatusRow } from "@/geo/county-scores/county-scores.repo";
import {
  getCountyScoresStatusSnapshot,
  listCountyScores,
} from "@/geo/county-scores/county-scores.repo";
import type {
  QueryCountyScoresArgs,
  QueryCountyScoresResult,
  QueryCountyScoresStatusResult,
} from "./county-scores.service.types";

const COUNTY_SCORES_RELATION_NAMES: readonly string[] = [
  "analytics.county_scores_v1",
  "analytics.county_metrics_v1",
  "analytics_meta.county_score_publications",
];

function compareCountyScores(left: CountyScore, right: CountyScore): number {
  if (left.compositeScore === null && right.compositeScore === null) {
    return left.countyFips.localeCompare(right.countyFips);
  }

  if (left.compositeScore === null) {
    return 1;
  }

  if (right.compositeScore === null) {
    return -1;
  }

  if (left.compositeScore !== right.compositeScore) {
    return right.compositeScore - left.compositeScore;
  }

  return left.countyFips.localeCompare(right.countyFips);
}

function uniqueCountyIds(countyIds: readonly string[]): readonly string[] {
  return [...new Set(countyIds)];
}

function readBooleanFlag(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "t" || normalized === "1";
}

function isCountyScoresSourceUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  if (!normalizedMessage.includes("does not exist")) {
    return false;
  }

  return COUNTY_SCORES_RELATION_NAMES.some((relationName) => error.message.includes(relationName));
}

function isCountyReferenceAvailable(row: CountyScoreRow): boolean {
  return readBooleanFlag(row.has_county_reference);
}

function isCountyScoreAvailable(row: CountyScoreRow): boolean {
  return readBooleanFlag(row.has_county_score);
}

function missingCountyIds(
  requestedCountyIds: readonly string[],
  rows: readonly CountyScoreRow[]
): readonly string[] {
  const returnedCountyIds = new Set(
    rows.filter((row) => isCountyReferenceAvailable(row)).map((row) => row.county_fips)
  );

  return requestedCountyIds.filter((countyId) => !returnedCountyIds.has(countyId));
}

function unavailableCountyIds(
  requestedCountyIds: readonly string[],
  rows: readonly CountyScoreRow[]
): readonly string[] {
  const availableCountyIds = new Set(
    rows
      .filter((row) => isCountyReferenceAvailable(row) && isCountyScoreAvailable(row))
      .map((row) => row.county_fips)
  );
  const unavailableReferenceCountyIds = new Set(
    rows
      .filter((row) => isCountyReferenceAvailable(row) && !isCountyScoreAvailable(row))
      .map((row) => row.county_fips)
  );

  return requestedCountyIds.filter(
    (countyId) => unavailableReferenceCountyIds.has(countyId) && !availableCountyIds.has(countyId)
  );
}

function readNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNonNegativeInteger(
  value: number | string | null | undefined,
  fieldName: string
): number {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }

    throw new Error(`invalid ${fieldName}`);
  }

  if (typeof value !== "string") {
    throw new Error(`missing ${fieldName}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`missing ${fieldName}`);
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed;
}

function readNullableIsoDateTime(
  value: Date | string | null | undefined,
  fieldName: string
): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`invalid ${fieldName}`);
    }

    return value.toISOString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`invalid ${fieldName}`);
  }

  return parsed.toISOString();
}

function readStringArray(value: unknown, fieldName: string): readonly string[] {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return [];
    }

    return readStringArray(JSON.parse(normalized), fieldName);
  }

  if (typeof value === "undefined" || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`invalid ${fieldName}`);
  }

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      throw new Error(`invalid ${fieldName}`);
    }

    const normalized = entry.trim();
    return normalized.length > 0 ? [normalized] : [];
  });
}

function hasFeature(availableFeatureFamilies: ReadonlySet<string>, featureName: string): boolean {
  return availableFeatureFamilies.has(featureName);
}

function hasPublishedCountyScores(status: Omit<CountyScoresStatusResponse, "meta">): boolean {
  return (
    status.datasetAvailable &&
    status.publicationRunId !== null &&
    status.dataVersion !== null &&
    status.formulaVersion !== null &&
    status.inputDataVersion !== null
  );
}

function mapCountyScoresStatusRow(
  row: CountyScoresStatusRow
): Omit<CountyScoresStatusResponse, "meta"> {
  const availableFeatureFamilies = new Set(
    readStringArray(row.available_feature_families, "available_feature_families")
  );
  const missingFeatureFamilies = readStringArray(
    row.missing_feature_families,
    "missing_feature_families"
  );
  const rowCount = readNonNegativeInteger(row.score_row_count, "score_row_count");
  const metricsRowCount = readNonNegativeInteger(row.metrics_row_count, "metrics_row_count");
  const sourceCountyCount = readNonNegativeInteger(row.source_county_count, "source_county_count");
  const scoredCountyCount =
    typeof row.scored_county_count === "undefined" || row.scored_county_count === null
      ? rowCount
      : readNonNegativeInteger(row.scored_county_count, "scored_county_count");
  const waterCoverageCount =
    typeof row.water_coverage_count === "undefined" || row.water_coverage_count === null
      ? 0
      : readNonNegativeInteger(row.water_coverage_count, "water_coverage_count");

  return {
    datasetAvailable:
      readNullableText(row.publication_status) === "published" &&
      readNullableText(row.publication_run_id) !== null &&
      rowCount > 0 &&
      metricsRowCount > 0,
    publicationRunId: readNullableText(row.publication_run_id),
    publishedAt: readNullableIsoDateTime(row.published_at, "published_at"),
    methodologyId: readNullableText(row.methodology_id),
    dataVersion: readNullableText(row.data_version),
    inputDataVersion: readNullableText(row.input_data_version),
    formulaVersion: readNullableText(row.formula_version),
    rowCount,
    sourceCountyCount,
    scoredCountyCount,
    waterCoverageCount,
    availableFeatureFamilies: [...availableFeatureFamilies],
    missingFeatureFamilies: [...missingFeatureFamilies],
    featureCoverage: {
      enterprise: hasFeature(availableFeatureFamilies, "enterprise"),
      facilities: hasFeature(availableFeatureFamilies, "facilities"),
      fiber: hasFeature(availableFeatureFamilies, "fiber"),
      hazards: hasFeature(availableFeatureFamilies, "hazards"),
      hyperscale: hasFeature(availableFeatureFamilies, "hyperscale"),
      policy: hasFeature(availableFeatureFamilies, "policy"),
      terrain: hasFeature(availableFeatureFamilies, "terrain"),
      transmission: hasFeature(availableFeatureFamilies, "transmission"),
      utilityTerritory: hasFeature(availableFeatureFamilies, "utility_territory"),
      waterStress: hasFeature(availableFeatureFamilies, "water_stress"),
    },
  };
}

export async function queryCountyScores(
  args: QueryCountyScoresArgs
): Promise<QueryCountyScoresResult> {
  const requestedCountyIds = uniqueCountyIds(args.countyIds);

  let rows: readonly CountyScoreRow[];
  let statusRow: CountyScoresStatusRow;
  try {
    [rows, statusRow] = await Promise.all([
      listCountyScores(requestedCountyIds),
      getCountyScoresStatusSnapshot(),
    ]);
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  try {
    const status = mapCountyScoresStatusRow(statusRow);
    if (!hasPublishedCountyScores(status)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error: new Error("county scores publication is unavailable"),
        },
      };
    }

    const publicationDataVersion = status.dataVersion;
    if (publicationDataVersion === null) {
      throw new Error("missing county scores publication data version");
    }

    const mappedRows = rows
      .filter((row) => isCountyReferenceAvailable(row))
      .map((row) => mapCountyScoreRow(row))
      .sort(compareCountyScores);

    return {
      ok: true,
      value: {
        dataVersion: publicationDataVersion,
        rows: mappedRows,
        missingCountyIds: missingCountyIds(requestedCountyIds, rows),
        requestedCountyIds,
        unavailableCountyIds: unavailableCountyIds(requestedCountyIds, rows),
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

export async function queryCountyScoresStatus(): Promise<QueryCountyScoresStatusResult> {
  let row: CountyScoresStatusRow;
  try {
    row = await getCountyScoresStatusSnapshot();
  } catch (error) {
    if (isCountyScoresSourceUnavailable(error)) {
      return {
        ok: false,
        value: {
          reason: "source_unavailable",
          error,
        },
      };
    }

    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  try {
    return {
      ok: true,
      value: mapCountyScoresStatusRow(row),
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
