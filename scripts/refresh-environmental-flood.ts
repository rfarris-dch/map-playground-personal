#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  ensureRunDirectories,
  materializeSource,
  parseArg,
  quoteSqlIdentifier,
  quoteSqlString,
  readOgrFeatureCount,
  readOgrFieldNames,
  readOgrGeometryFieldName,
  requireArg,
  resolveOgrDataSourcePath,
  resolveOgrFieldName,
  resolveOgrLayerName,
  resolveRunContext,
  runCommand,
  verifyRunConfig,
  writeJsonFile,
  writeRunConfig,
} from "./environmental/environmental-sync.service";
import type { RunConfigRecord } from "./environmental/environmental-sync.types";

const STRICT_FLOOD_100_ZONE_SQL = "'A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE'";

function currentStep(): string {
  return requireArg("--step");
}

function resolveFieldNames(
  dataSourcePath: string,
  layerName: string
): {
  readonly dfirmIdField: string | null;
  readonly fldZoneField: string;
  readonly sfhaField: string | null;
  readonly sourceCitationField: string | null;
  readonly zoneSubtypeField: string | null;
} {
  const fieldNames = readOgrFieldNames(dataSourcePath, layerName);
  return {
    dfirmIdField: resolveOgrFieldName(fieldNames, ["DFIRM_ID"], false),
    fldZoneField: resolveOgrFieldName(fieldNames, ["FLD_ZONE", "ZONE"], true) ?? "FLD_ZONE",
    sfhaField: resolveOgrFieldName(fieldNames, ["SFHA_TF"], false),
    sourceCitationField: resolveOgrFieldName(fieldNames, ["SOURCE_CIT"], false),
    zoneSubtypeField: resolveOgrFieldName(fieldNames, ["ZONE_SUBTY", "ZONE_SUBTYPE"], false),
  };
}

function sqlTextExpression(fieldName: string | null): string {
  if (fieldName === null) {
    return "CAST(NULL AS TEXT)";
  }

  return `CAST(${quoteSqlIdentifier(fieldName)} AS TEXT)`;
}

function sqlUpperTextExpression(fieldName: string | null): string {
  return `UPPER(${sqlTextExpression(fieldName)})`;
}

function sqlUpperTrimTextExpression(fieldName: string | null): string {
  return `UPPER(TRIM(${sqlTextExpression(fieldName)}))`;
}

function readRunConfig(path: string): RunConfigRecord {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    typeof parsed.runId !== "string" ||
    typeof parsed.dataset !== "string" ||
    typeof parsed.dataVersion !== "string"
  ) {
    throw new Error(`Invalid run config: ${path}`);
  }

  const options =
    typeof parsed.options === "object" && parsed.options !== null && !Array.isArray(parsed.options)
      ? Object.entries(parsed.options).reduce<Record<string, string>>((result, entry) => {
          const [key, value] = entry;
          if (typeof value === "string") {
            result[key] = value;
          }
          return result;
        }, {})
      : {};

  const sourcePath = typeof parsed.sourcePath === "string" ? parsed.sourcePath : undefined;
  const sourceUrl = typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : undefined;

  return {
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
    dataVersion: parsed.dataVersion,
    dataset:
      parsed.dataset === "environmental-hydro-basins"
        ? "environmental-hydro-basins"
        : "environmental-flood",
    options,
    runId: parsed.runId,
    ...(typeof sourcePath === "string" ? { sourcePath } : {}),
    ...(typeof sourceUrl === "string" ? { sourceUrl } : {}),
  };
}

function extractStep(): void {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  ensureRunDirectories(context);

  const sourcePath =
    parseArg("--source-path") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_PATH ?? null;
  const sourceUrl = parseArg("--source-url") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_URL ?? null;
  const dataVersion =
    parseArg("--data-version") ?? process.env.ENVIRONMENTAL_FLOOD_DATA_VERSION ?? context.runId;
  const sourceLayer =
    parseArg("--source-layer") ?? process.env.ENVIRONMENTAL_FLOOD_SOURCE_LAYER ?? null;

  verifyRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: {
      sourceLayer: sourceLayer ?? "",
    },
    runId: context.runId,
    sourcePath,
    sourceUrl,
  });

  const materializedSource = materializeSource(
    context.rawDir,
    sourcePath,
    sourceUrl,
    "nfhl-source"
  );
  const ogrDataSourcePath = resolveOgrDataSourcePath(materializedSource.localPath);
  const layerName = resolveOgrLayerName(ogrDataSourcePath, sourceLayer, ["S_Fld_Haz_Ar"]);

  writeRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: {
      layerName,
      materializedSourceName: basename(materializedSource.localPath),
      sourceLayer: sourceLayer ?? "",
    },
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
  writeJsonFile(context.runSummaryPath, {
    completedAt: new Date().toISOString(),
    dataVersion,
    dataset: context.dataset,
    featureCount: readOgrFeatureCount(ogrDataSourcePath, layerName),
    layerName,
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
}

function normalizeStep(): void {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  const runConfig = readRunConfig(context.runConfigPath);
  const dataVersion = runConfig.dataVersion;
  const materializedSourceName = runConfig.options.materializedSourceName;
  const layerName = runConfig.options.layerName;

  if (typeof materializedSourceName !== "string" || materializedSourceName.length === 0) {
    throw new Error(`Missing materializedSourceName in ${context.runConfigPath}`);
  }

  if (typeof layerName !== "string" || layerName.length === 0) {
    throw new Error(`Missing layerName in ${context.runConfigPath}`);
  }

  const localSourcePath = join(context.rawDir, materializedSourceName);
  const ogrDataSourcePath = resolveOgrDataSourcePath(localSourcePath);
  const geometryField = readOgrGeometryFieldName(ogrDataSourcePath, layerName);
  const fieldNames = resolveFieldNames(ogrDataSourcePath, layerName);

  const fldZoneExpression = sqlUpperTextExpression(fieldNames.fldZoneField);
  const zoneSubtypeExpression = sqlUpperTextExpression(fieldNames.zoneSubtypeField);
  const sfhaExpression = sqlUpperTrimTextExpression(fieldNames.sfhaField);
  const isFlood100Condition = `(${sfhaExpression} IN ('T', 'TRUE', 'Y') OR ${fldZoneExpression} IN (${STRICT_FLOOD_100_ZONE_SQL}))`;
  const isFlood500Condition = `(NOT ${isFlood100Condition} AND ${fldZoneExpression} = 'X' AND ${zoneSubtypeExpression} LIKE '%0.2%')`;

  const sql = [
    "SELECT",
    `${sqlTextExpression(fieldNames.dfirmIdField)} AS DFIRM_ID,`,
    `${fldZoneExpression} AS FLD_ZONE,`,
    `${zoneSubtypeExpression} AS ZONE_SUBTY,`,
    `${sfhaExpression} AS SFHA_TF,`,
    `${sqlTextExpression(fieldNames.sourceCitationField)} AS SOURCE_CIT,`,
    `CASE WHEN ${isFlood100Condition} THEN 1 ELSE 0 END AS is_flood_100,`,
    `CASE WHEN ${isFlood500Condition} THEN 1 ELSE 0 END AS is_flood_500,`,
    "CASE",
    `  WHEN ${isFlood100Condition} THEN 'flood-100'`,
    `  WHEN ${isFlood500Condition} THEN 'flood-500'`,
    `  ELSE 'other'`,
    "END AS flood_band,",
    "CASE",
    `  WHEN ${isFlood100Condition} THEN 'flood-100'`,
    `  WHEN ${isFlood500Condition} THEN 'flood-500'`,
    `  ELSE 'other'`,
    "END AS legend_key,",
    `${quoteSqlString(dataVersion)} AS data_version,`,
    `${quoteSqlIdentifier(geometryField)} AS geometry`,
    `FROM ${quoteSqlIdentifier(layerName)}`,
    `WHERE ${isFlood100Condition} OR ${isFlood500Condition}`,
  ].join(" ");

  runCommand("ogr2ogr", [
    "-f",
    "GeoJSON",
    join(context.normalizedDir, "flood-hazard.geojson"),
    ogrDataSourcePath,
    "-dialect",
    "SQLite",
    "-sql",
    sql,
    "-nlt",
    "PROMOTE_TO_MULTI",
  ]);
}

const step = currentStep();
if (step === "extract") {
  extractStep();
} else if (step === "normalize") {
  normalizeStep();
} else {
  throw new Error(`Unsupported step: ${step}`);
}
