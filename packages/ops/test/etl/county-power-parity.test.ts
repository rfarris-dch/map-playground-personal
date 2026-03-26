import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildCountyPowerGoldMartSpecs } from "../../src/etl/county-power-gold-marts";
import { validateCountyPowerPublicationParity } from "../../src/etl/county-power-parity";
import {
  ensureCountyPowerRunDirectories,
  resolveCountyPowerRunContext,
} from "../../src/etl/county-power-sync";
import type { CountyPowerBundleManifest } from "../../src/etl/county-power-sync.types";

const GOLD_TARGET_RE = /mart=([^/'\s]+)/;
const CSV_TARGET_RE = /\/([^/'\s]+)\.csv/;
const tempPaths: string[] = [];

interface MockParityFixture {
  readonly parquetRows: readonly Readonly<Record<string, unknown>>[];
  readonly parquetSchema: readonly Readonly<Record<string, unknown>>[];
  readonly postgresRows: readonly Readonly<Record<string, unknown>>[];
  readonly postgresSchema: readonly Readonly<Record<string, unknown>>[];
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeNdjsonFile(path: string): readonly Readonly<Record<string, unknown>>[] {
  const text = readFileSync(path, "utf8").trim();
  if (text.length === 0) {
    return [];
  }

  return text.split("\n").flatMap((line) => {
    const parsed = JSON.parse(line);
    return isJsonRecord(parsed) ? [parsed] : [];
  });
}

function createTempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "county-power-parity-"));
  tempPaths.push(path);
  return path;
}

function createParityManifest(): CountyPowerBundleManifest {
  const datasetDescriptor = {
    path: "fixture.parquet",
    recordCount: 1,
    sourceAsOfDate: "2026-03-24",
    sourceName: "fixture",
    sourceUri: "https://example.com/fixture",
    sourceVersion: "2026-03-24",
  };

  return {
    bundleVersion: "county-power-v1",
    dataVersion: "2026-03-24",
    datasets: {
      congestion: datasetDescriptor,
      countyFipsAliases: datasetDescriptor,
      countyOperatorRegions: datasetDescriptor,
      countyOperatorZones: datasetDescriptor,
      fiber: datasetDescriptor,
      gas: datasetDescriptor,
      gridFriction: datasetDescriptor,
      operatorRegions: datasetDescriptor,
      operatorZoneReferences: datasetDescriptor,
      policyEvents: datasetDescriptor,
      policySnapshots: datasetDescriptor,
      powerMarketContext: datasetDescriptor,
      queueCountyResolutions: datasetDescriptor,
      queuePoiReferences: datasetDescriptor,
      queueProjects: datasetDescriptor,
      queueResolutionOverrides: datasetDescriptor,
      queueSnapshots: datasetDescriptor,
      queueUnresolved: datasetDescriptor,
      transmission: datasetDescriptor,
      utilityContext: datasetDescriptor,
    },
    effectiveDate: "2026-03-24",
    generatedAt: "2026-03-24T18:35:52.000Z",
    month: "2026-03-01",
  };
}

function writeGoldFixtures(args: {
  readonly publicationRunId: string;
  readonly projectRoot: string;
  readonly runId: string;
}): ReturnType<typeof resolveCountyPowerRunContext> {
  const context = resolveCountyPowerRunContext(args.projectRoot, args.runId);
  ensureCountyPowerRunDirectories(context);

  for (const spec of buildCountyPowerGoldMartSpecs({
    context,
    publicationRunId: args.publicationRunId,
  })) {
    mkdirSync(dirname(spec.outputFilePath), {
      recursive: true,
    });
    writeFileSync(spec.outputFilePath, "parquet-fixture");
  }

  return context;
}

function extractTargetName(sql: string): string {
  const goldMatch = sql.match(GOLD_TARGET_RE);
  if (goldMatch?.[1] !== undefined) {
    return goldMatch[1];
  }

  const csvMatch = sql.match(CSV_TARGET_RE);
  if (csvMatch?.[1] !== undefined) {
    return csvMatch[1];
  }

  throw new Error(`Unable to resolve parity target from SQL: ${sql}`);
}

function createParityRunner(fixtures: Readonly<Record<string, MockParityFixture>>) {
  return (options: { readonly outputMode?: "csv" | "json" | "text"; readonly sql: string }) => {
    if (options.outputMode === "json") {
      const targetName = extractTargetName(options.sql);
      const fixture = fixtures[targetName];
      if (fixture === undefined) {
        throw new Error(`Missing parity fixture for ${targetName}`);
      }

      const usesParquet = options.sql.includes("read_parquet(");
      const rows = (() => {
        if (options.sql.includes("DESCRIBE SELECT")) {
          return usesParquet ? fixture.parquetSchema : fixture.postgresSchema;
        }

        return usesParquet ? fixture.parquetRows : fixture.postgresRows;
      })();

      return Promise.resolve({
        durationMs: 1,
        exitCode: 0,
        stderr: "",
        stdout: `\u001b[90m-- Loading resources from bootstrap.sql\n\u001b[00m${JSON.stringify(rows)}`,
      });
    }

    const outputPaths = [...options.sql.matchAll(/TO '([^']+)'/g)].map((match) => match[1] ?? "");
    const inputPaths = [...options.sql.matchAll(/read_ndjson_auto\('([^']+)'\)/g)].map(
      (match) => match[1] ?? ""
    );
    for (const [index, outputPath] of outputPaths.entries()) {
      mkdirSync(dirname(outputPath), {
        recursive: true,
      });
      const inputPath = inputPaths[index];
      if (typeof inputPath === "string" && inputPath.length > 0) {
        writeFileSync(outputPath, readFileSync(inputPath, "utf8"), "utf8");
        continue;
      }

      writeFileSync(outputPath, "parquet-fixture");
    }

    return Promise.resolve({
      durationMs: 1,
      exitCode: 0,
      stderr: "",
      stdout: "",
    });
  };
}

function createPassingFixtures(
  publicationRunId: string
): Readonly<Record<string, MockParityFixture>> {
  return {
    county_score_snapshot: {
      parquetRows: [
        {
          county_geoid: "48453",
          county_name: "Travis",
          market_pressure_index: 87.3,
          publication_run_id: publicationRunId,
          source_provenance_json: { queue: "2026-03-20" },
          top_constraints_json: [{ constraintId: "ercot-west-001", shadowPrice: 29.4 }],
          utility_context_json: { primaryUtility: "Oncor" },
        },
      ],
      parquetSchema: [
        { column_name: "publication_run_id", column_type: "VARCHAR" },
        { column_name: "county_geoid", column_type: "VARCHAR" },
        { column_name: "county_name", column_type: "VARCHAR" },
        { column_name: "market_pressure_index", column_type: "DOUBLE" },
        { column_name: "top_constraints_json", column_type: "JSON" },
        { column_name: "utility_context_json", column_type: "JSON" },
        { column_name: "source_provenance_json", column_type: "JSON" },
      ],
      postgresRows: [
        {
          county_geoid: "48453",
          county_name: "Travis",
          market_pressure_index: 87.3,
          publication_run_id: publicationRunId,
          source_provenance_json: '{"queue":"2026-03-20"}',
          top_constraints_json: '[{"constraintId":"ercot-west-001","shadowPrice":29.4}]',
          utility_context_json: '{"primaryUtility":"Oncor"}',
        },
      ],
      postgresSchema: [
        { column_name: "publication_run_id", column_type: "VARCHAR" },
        { column_name: "county_geoid", column_type: "VARCHAR" },
        { column_name: "county_name", column_type: "VARCHAR" },
        { column_name: "market_pressure_index", column_type: "DOUBLE" },
        { column_name: "top_constraints_json", column_type: "VARCHAR" },
        { column_name: "utility_context_json", column_type: "VARCHAR" },
        { column_name: "source_provenance_json", column_type: "VARCHAR" },
      ],
    },
    coverage_by_operator: {
      parquetRows: [
        {
          avg_rt_congestion_component_count: 1,
          county_count: 1,
          meteo_zone_count: 1,
          operator_weather_zone_count: 1,
          operator_zone_label_count: 1,
          p95_shadow_price_count: 1,
          primary_tdu_or_utility_count: 1,
          wholesale_operator: "ERCOT",
        },
      ],
      parquetSchema: [
        { column_name: "wholesale_operator", column_type: "VARCHAR" },
        { column_name: "county_count", column_type: "INTEGER" },
        { column_name: "operator_zone_label_count", column_type: "INTEGER" },
        { column_name: "operator_weather_zone_count", column_type: "INTEGER" },
        { column_name: "meteo_zone_count", column_type: "INTEGER" },
        { column_name: "avg_rt_congestion_component_count", column_type: "INTEGER" },
        { column_name: "p95_shadow_price_count", column_type: "INTEGER" },
        { column_name: "primary_tdu_or_utility_count", column_type: "INTEGER" },
      ],
      postgresRows: [
        {
          avg_rt_congestion_component_count: 1,
          county_count: 1,
          meteo_zone_count: 1,
          operator_weather_zone_count: 1,
          operator_zone_label_count: 1,
          p95_shadow_price_count: 1,
          primary_tdu_or_utility_count: 1,
          wholesale_operator: "ERCOT",
        },
      ],
      postgresSchema: [
        { column_name: "wholesale_operator", column_type: "VARCHAR" },
        { column_name: "county_count", column_type: "INTEGER" },
        { column_name: "operator_zone_label_count", column_type: "INTEGER" },
        { column_name: "operator_weather_zone_count", column_type: "INTEGER" },
        { column_name: "meteo_zone_count", column_type: "INTEGER" },
        { column_name: "avg_rt_congestion_component_count", column_type: "INTEGER" },
        { column_name: "p95_shadow_price_count", column_type: "INTEGER" },
        { column_name: "primary_tdu_or_utility_count", column_type: "INTEGER" },
      ],
    },
    coverage_fields: {
      parquetRows: [
        { field_name: "avgRtCongestionComponent", populated_count: 1, total_count: 1 },
        { field_name: "wholesaleOperator", populated_count: 1, total_count: 1 },
      ],
      parquetSchema: [
        { column_name: "field_name", column_type: "VARCHAR" },
        { column_name: "populated_count", column_type: "INTEGER" },
        { column_name: "total_count", column_type: "INTEGER" },
      ],
      postgresRows: [
        { field_name: "avgRtCongestionComponent", populated_count: 1, total_count: 1 },
        { field_name: "wholesaleOperator", populated_count: 1, total_count: 1 },
      ],
      postgresSchema: [
        { column_name: "field_name", column_type: "VARCHAR" },
        { column_name: "populated_count", column_type: "INTEGER" },
        { column_name: "total_count", column_type: "INTEGER" },
      ],
    },
    publication_summary: {
      parquetRows: [
        {
          available_feature_families: ["demand", "narratives"],
          missing_feature_families: [],
          notes: { summary: "published" },
          publication_run_id: publicationRunId,
          row_count: 1,
          source_versions_json: { queue: "2026-03-20" },
        },
      ],
      parquetSchema: [
        { column_name: "publication_run_id", column_type: "VARCHAR" },
        { column_name: "row_count", column_type: "INTEGER" },
        { column_name: "available_feature_families", column_type: "VARCHAR[]" },
        { column_name: "missing_feature_families", column_type: "VARCHAR[]" },
        { column_name: "source_versions_json", column_type: "JSON" },
        { column_name: "notes", column_type: "JSON" },
      ],
      postgresRows: [
        {
          available_feature_families: "{demand,narratives}",
          missing_feature_families: "{}",
          notes: '{"summary":"published"}',
          publication_run_id: publicationRunId,
          row_count: 1,
          source_versions_json: '{"queue":"2026-03-20"}',
        },
      ],
      postgresSchema: [
        { column_name: "publication_run_id", column_type: "VARCHAR" },
        { column_name: "row_count", column_type: "INTEGER" },
        { column_name: "available_feature_families", column_type: "VARCHAR" },
        { column_name: "missing_feature_families", column_type: "VARCHAR" },
        { column_name: "source_versions_json", column_type: "VARCHAR" },
        { column_name: "notes", column_type: "VARCHAR" },
      ],
    },
    qa_congestion: {
      parquetRows: [
        {
          avg_rt_congestion_component: 4.8,
          county_fips: "48453",
          negative_price_hour_share: 0.07,
          p95_shadow_price: 29.4,
          source_as_of_date: "2026-03-24",
        },
      ],
      parquetSchema: [
        { column_name: "county_fips", column_type: "VARCHAR" },
        { column_name: "avg_rt_congestion_component", column_type: "DOUBLE" },
        { column_name: "p95_shadow_price", column_type: "DOUBLE" },
        { column_name: "negative_price_hour_share", column_type: "DOUBLE" },
        { column_name: "source_as_of_date", column_type: "DATE" },
      ],
      postgresRows: [
        {
          avg_rt_congestion_component: 4.8,
          county_fips: "48453",
          negative_price_hour_share: 0.07,
          p95_shadow_price: 29.4,
          source_as_of_date: "2026-03-24",
        },
      ],
      postgresSchema: [
        { column_name: "county_fips", column_type: "VARCHAR" },
        { column_name: "avg_rt_congestion_component", column_type: "DOUBLE" },
        { column_name: "p95_shadow_price", column_type: "DOUBLE" },
        { column_name: "negative_price_hour_share", column_type: "DOUBLE" },
        { column_name: "source_as_of_date", column_type: "DATE" },
      ],
    },
    qa_operator_zone: {
      parquetRows: [
        {
          allocation_share: 1,
          county_fips: "48453",
          operator_zone_confidence: "medium",
          operator_zone_label: "LCRA",
          operator_zone_type: "load_zone",
          resolution_method: "public_queue_zone",
          source_as_of_date: "2026-03-24",
          wholesale_operator: "ERCOT",
        },
      ],
      parquetSchema: [
        { column_name: "county_fips", column_type: "VARCHAR" },
        { column_name: "wholesale_operator", column_type: "VARCHAR" },
        { column_name: "operator_zone_label", column_type: "VARCHAR" },
        { column_name: "operator_zone_type", column_type: "VARCHAR" },
        { column_name: "operator_zone_confidence", column_type: "VARCHAR" },
        { column_name: "resolution_method", column_type: "VARCHAR" },
        { column_name: "allocation_share", column_type: "INTEGER" },
        { column_name: "source_as_of_date", column_type: "DATE" },
      ],
      postgresRows: [
        {
          allocation_share: 1,
          county_fips: "48453",
          operator_zone_confidence: "medium",
          operator_zone_label: "LCRA",
          operator_zone_type: "load_zone",
          resolution_method: "public_queue_zone",
          source_as_of_date: "2026-03-24",
          wholesale_operator: "ERCOT",
        },
      ],
      postgresSchema: [
        { column_name: "county_fips", column_type: "VARCHAR" },
        { column_name: "wholesale_operator", column_type: "VARCHAR" },
        { column_name: "operator_zone_label", column_type: "VARCHAR" },
        { column_name: "operator_zone_type", column_type: "VARCHAR" },
        { column_name: "operator_zone_confidence", column_type: "VARCHAR" },
        { column_name: "resolution_method", column_type: "VARCHAR" },
        { column_name: "allocation_share", column_type: "INTEGER" },
        { column_name: "source_as_of_date", column_type: "DATE" },
      ],
    },
    resolution_by_source: {
      parquetRows: [
        {
          derived_resolution_count: 0,
          direct_resolution_count: 1,
          effective_date: "2026-03-24",
          low_confidence_resolution_count: 0,
          manual_resolution_count: 0,
          sample_location_labels: ["Travis County"],
          sample_poi_labels: ["Austin Energy"],
          sample_snapshot_location_labels: [],
          sample_snapshot_poi_labels: [],
          source_system: "ercot-gis",
          total_projects: 1,
          total_snapshots: 1,
          unresolved_projects: 0,
          unresolved_snapshots: 0,
        },
      ],
      parquetSchema: [
        { column_name: "source_system", column_type: "VARCHAR" },
        { column_name: "total_projects", column_type: "INTEGER" },
        { column_name: "unresolved_projects", column_type: "INTEGER" },
        { column_name: "total_snapshots", column_type: "INTEGER" },
        { column_name: "unresolved_snapshots", column_type: "INTEGER" },
        { column_name: "direct_resolution_count", column_type: "INTEGER" },
        { column_name: "derived_resolution_count", column_type: "INTEGER" },
        { column_name: "manual_resolution_count", column_type: "INTEGER" },
        { column_name: "low_confidence_resolution_count", column_type: "INTEGER" },
        { column_name: "sample_poi_labels", column_type: "JSON" },
        { column_name: "sample_location_labels", column_type: "JSON" },
        { column_name: "sample_snapshot_poi_labels", column_type: "JSON" },
        { column_name: "sample_snapshot_location_labels", column_type: "JSON" },
        { column_name: "effective_date", column_type: "DATE" },
      ],
      postgresRows: [
        {
          derived_resolution_count: 0,
          direct_resolution_count: 1,
          effective_date: "2026-03-24",
          low_confidence_resolution_count: 0,
          manual_resolution_count: 0,
          sample_location_labels: '["Travis County"]',
          sample_poi_labels: '["Austin Energy"]',
          sample_snapshot_location_labels: "[]",
          sample_snapshot_poi_labels: "[]",
          source_system: "ercot-gis",
          total_projects: 1,
          total_snapshots: 1,
          unresolved_projects: 0,
          unresolved_snapshots: 0,
        },
      ],
      postgresSchema: [
        { column_name: "source_system", column_type: "VARCHAR" },
        { column_name: "total_projects", column_type: "INTEGER" },
        { column_name: "unresolved_projects", column_type: "INTEGER" },
        { column_name: "total_snapshots", column_type: "INTEGER" },
        { column_name: "unresolved_snapshots", column_type: "INTEGER" },
        { column_name: "direct_resolution_count", column_type: "INTEGER" },
        { column_name: "derived_resolution_count", column_type: "INTEGER" },
        { column_name: "manual_resolution_count", column_type: "INTEGER" },
        { column_name: "low_confidence_resolution_count", column_type: "INTEGER" },
        { column_name: "sample_poi_labels", column_type: "VARCHAR" },
        { column_name: "sample_location_labels", column_type: "VARCHAR" },
        { column_name: "sample_snapshot_poi_labels", column_type: "VARCHAR" },
        { column_name: "sample_snapshot_location_labels", column_type: "VARCHAR" },
        { column_name: "effective_date", column_type: "DATE" },
      ],
    },
  };
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const path = tempPaths.pop();
    if (typeof path === "string") {
      rmSync(path, {
        force: true,
        recursive: true,
      });
    }
  }
});

describe("county-power-parity", () => {
  it("writes QA artifacts and passes when Postgres and Parquet are logically equivalent", async () => {
    const publicationRunId = "county-market-pressure-run-001";
    const context = writeGoldFixtures({
      projectRoot: createTempDir(),
      publicationRunId,
      runId: "county-power-sync-2026-03-26T12-00-00Z",
    });

    const result = await validateCountyPowerPublicationParity({
      context,
      env: {
        DATABASE_URL: "postgresql://example.com/map_test",
      },
      exporter: ({ csvPath }) => {
        writeFileSync(csvPath, "fixture\n", "utf8");
        return Promise.resolve();
      },
      manifest: createParityManifest(),
      publicationRunId,
      runner: createParityRunner(createPassingFixtures(publicationRunId)),
    });

    const assertionRows = decodeNdjsonFile(context.qaAssertionsPath);
    const profileRows = decodeNdjsonFile(context.qaProfilePath);

    expect(result.passed).toBe(true);
    expect(result.failedAssertions).toBe(0);
    expect(readFileSync(context.lakeManifestPath, "utf8")).toContain(
      '"layer": "parity_assertions"'
    );
    expect(readFileSync(context.lakeManifestPath, "utf8")).toContain('"layer": "parity_profile"');
    expect(assertionRows.length).toBeGreaterThan(0);
    expect(assertionRows.every((row) => row.passed === true)).toBe(true);
    expect(profileRows.some((row) => row.source_name === "parquet")).toBe(true);
    expect(profileRows.some((row) => row.source_name === "postgres")).toBe(true);
  });

  it("fails with blocking assertions when a derived parity target diverges and still emits QA artifacts", async () => {
    const publicationRunId = "county-market-pressure-run-002";
    const context = writeGoldFixtures({
      projectRoot: createTempDir(),
      publicationRunId,
      runId: "county-power-sync-2026-03-26T12-30-00Z",
    });
    const fixtures = createPassingFixtures(publicationRunId);
    const mismatchedFixtures = {
      ...fixtures,
      coverage_fields: {
        ...fixtures.coverage_fields,
        postgresRows: [
          { field_name: "avgRtCongestionComponent", populated_count: 1, total_count: 1 },
          { field_name: "wholesaleOperator", populated_count: 1, total_count: 2 },
        ],
      },
    };

    const result = await validateCountyPowerPublicationParity({
      context,
      env: {
        DATABASE_URL: "postgresql://example.com/map_test",
      },
      exporter: ({ csvPath }) => {
        writeFileSync(csvPath, "fixture\n", "utf8");
        return Promise.resolve();
      },
      manifest: createParityManifest(),
      publicationRunId,
      runner: createParityRunner(mismatchedFixtures),
    });

    expect(result.passed).toBe(false);
    expect(result.failedAssertions).toBeGreaterThan(0);
    expect(readFileSync(context.lakeManifestPath, "utf8")).toContain(
      '"layer": "parity_assertions"'
    );
    expect(decodeNdjsonFile(context.qaAssertionsPath).some((row) => row.passed === false)).toBe(
      true
    );
  });
});
