#!/usr/bin/env bun
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildBoundaryLineFeatures,
  ensureRunDirectories,
  materializeSource,
  optionalNumber,
  optionalString,
  parseArg,
  quoteSqlIdentifier,
  quoteSqlString,
  readGeoJsonFeatureCollection,
  readOgrFeatureCount,
  readOgrFieldNames,
  readOgrGeometryFieldName,
  resolveOgrDataSourcePath,
  resolveOgrFieldName,
  resolveOgrLayerName,
  resolveRunContext,
  runCommand,
  verifyRunConfig,
  writeFeatureCollection,
  writeJsonFile,
  writeRunConfig,
} from "./environmental/environmental-sync.service";
import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  RunConfigRecord,
} from "./environmental/environmental-sync.types";

const HUC_LEVELS: readonly number[] = [4, 6, 8, 10, 12];

function currentStep(): string {
  const step = parseArg("--step");
  if (typeof step !== "string" || step.trim().length === 0) {
    throw new Error("Missing required argument --step=extract|normalize");
  }

  return step.trim();
}

function layerEnvName(level: number): string {
  return `ENVIRONMENTAL_HYDRO_HUC${String(level)}_LAYER`;
}

function resolveDataVersion(runId: string): string {
  return parseArg("--data-version") ?? process.env.ENVIRONMENTAL_HYDRO_DATA_VERSION ?? runId;
}

function resolveConfiguredLayer(level: number): string | null {
  return parseArg(`--huc${String(level)}-layer`) ?? process.env[layerEnvName(level)] ?? null;
}

function listDirectoryPolygonSources(path: string): readonly string[] {
  if (!existsSync(path)) {
    return [];
  }

  if (!lstatSync(path).isDirectory()) {
    return [];
  }

  return readdirSync(path).map((entry) => join(path, entry));
}

function resolvePolygonSourceFromDirectory(directoryPath: string, level: number): string | null {
  const expectedName = `huc${String(level)}-polygon.geojson`;
  const entries = listDirectoryPolygonSources(directoryPath);
  for (const entry of entries) {
    if (entry.endsWith(expectedName)) {
      return entry;
    }
  }

  return null;
}

function sqlFieldExpression(fieldName: string | null, fallbackType: "REAL" | "TEXT"): string {
  if (fieldName === null) {
    return `CAST(NULL AS ${fallbackType})`;
  }

  return `CAST(${quoteSqlIdentifier(fieldName)} AS ${fallbackType})`;
}

function buildExtractOptions(): Record<string, string> {
  return HUC_LEVELS.reduce<Record<string, string>>((result, level) => {
    result[`huc${String(level)}Layer`] = resolveConfiguredLayer(level) ?? "";
    return result;
  }, {});
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
      parsed.dataset === "environmental-flood"
        ? "environmental-flood"
        : "environmental-hydro-basins",
    options,
    runId: parsed.runId,
    ...(typeof sourcePath === "string" ? { sourcePath } : {}),
    ...(typeof sourceUrl === "string" ? { sourceUrl } : {}),
  };
}

function resolveLocalSourcePath(contextRawDir: string, config: RunConfigRecord): string {
  const materializedSourceName = config.options.materializedSourceName;
  if (typeof materializedSourceName === "string" && materializedSourceName.length > 0) {
    return join(contextRawDir, materializedSourceName);
  }

  const entries = readdirSync(contextRawDir);
  const candidate = entries.find((entry) => entry.endsWith(".gpkg") || entry.endsWith(".zip"));
  if (typeof candidate === "string") {
    return join(contextRawDir, candidate);
  }

  const directoryCandidate = entries.find((entry) =>
    lstatSync(join(contextRawDir, entry)).isDirectory()
  );
  if (typeof directoryCandidate === "string") {
    return join(contextRawDir, directoryCandidate);
  }

  throw new Error(`Unable to resolve local hydro source in ${contextRawDir}`);
}

function resolveSourceLayer(
  level: number,
  ogrDataSourcePath: string,
  options: Readonly<Record<string, string>>
): string {
  const configuredLayer = options[`huc${String(level)}Layer`] ?? null;
  return resolveOgrLayerName(ogrDataSourcePath, configuredLayer, [`WBDHU${String(level)}`]);
}

function extractStep(): void {
  const context = resolveRunContext("environmental-hydro-basins", import.meta.url);
  ensureRunDirectories(context);

  const sourcePath =
    parseArg("--source-path") ?? process.env.ENVIRONMENTAL_HYDRO_SOURCE_PATH ?? null;
  const sourceUrl = parseArg("--source-url") ?? process.env.ENVIRONMENTAL_HYDRO_SOURCE_URL ?? null;
  const dataVersion = resolveDataVersion(context.runId);
  const extractOptions = buildExtractOptions();

  verifyRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: extractOptions,
    runId: context.runId,
    sourcePath,
    sourceUrl,
  });

  const materializedSource = materializeSource(context.rawDir, sourcePath, sourceUrl, "wbd-source");
  const localSourcePath = materializedSource.localPath;

  const levels = HUC_LEVELS.map((level) => {
    const directoryPolygonSource = resolvePolygonSourceFromDirectory(localSourcePath, level);
    if (typeof directoryPolygonSource === "string") {
      const ogrDataSourcePath = resolveOgrDataSourcePath(directoryPolygonSource);
      const sourceLayer = resolveOgrLayerName(ogrDataSourcePath, null, []);
      return {
        featureCount: readOgrFeatureCount(ogrDataSourcePath, sourceLayer),
        level,
        sourceLayer,
      };
    }

    const ogrDataSourcePath = resolveOgrDataSourcePath(localSourcePath);
    const sourceLayer = resolveSourceLayer(level, ogrDataSourcePath, extractOptions);
    return {
      featureCount: readOgrFeatureCount(ogrDataSourcePath, sourceLayer),
      level,
      sourceLayer,
    };
  });

  writeRunConfig(context.runConfigPath, {
    dataVersion,
    dataset: context.dataset,
    options: {
      ...extractOptions,
      materializedSourceName: localSourcePath.split("/").pop() ?? "wbd-source",
    },
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
  writeJsonFile(context.runSummaryPath, {
    completedAt: new Date().toISOString(),
    dataVersion,
    dataset: context.dataset,
    levels,
    runId: context.runId,
    sourcePath: materializedSource.sourcePath,
    sourceUrl: materializedSource.sourceUrl,
  });
}

function readDataVersion(contextRunSummaryPath: string, runId: string): string {
  const parsed = JSON.parse(readFileSync(contextRunSummaryPath, "utf8"));
  return typeof parsed.dataVersion === "string" ? parsed.dataVersion : runId;
}

function buildLabelFileFromPolygonGeoJson(polygonPath: string, outputPath: string): void {
  const layerName = resolveOgrLayerName(polygonPath, null, []);
  const sql = [
    "SELECT",
    "CAST(name AS TEXT) AS name,",
    "CAST(huc AS TEXT) AS huc,",
    "CAST(areasqkm AS REAL) AS areasqkm,",
    "CAST(COALESCE(areasqkm, 0) AS REAL) AS label_rank,",
    "CAST(states AS TEXT) AS states,",
    "CAST(data_version AS TEXT) AS data_version,",
    `ST_PointOnSurface(geometry) AS geometry FROM ${quoteSqlIdentifier(layerName)}`,
  ].join(" ");

  runCommand("ogr2ogr", [
    "-f",
    "GeoJSON",
    outputPath,
    polygonPath,
    "-dialect",
    "SQLite",
    "-sql",
    sql,
  ]);
}

function buildLabelFileFromSourceLayer(
  level: number,
  ogrDataSourcePath: string,
  sourceLayer: string,
  outputPath: string,
  dataVersion: string
): void {
  const fieldNames = readOgrFieldNames(ogrDataSourcePath, sourceLayer);
  const geometryField = readOgrGeometryFieldName(ogrDataSourcePath, sourceLayer);
  const nameField = resolveOgrFieldName(fieldNames, ["name", "NAME"], true);
  const hucField = resolveOgrFieldName(
    fieldNames,
    [`huc${String(level)}`, `HUC${String(level)}`, "huc", "HUC"],
    true
  );
  const areaField = resolveOgrFieldName(fieldNames, ["areasqkm", "AreaSqKm", "label_rank"], false);
  const statesField = resolveOgrFieldName(fieldNames, ["states", "States"], false);

  const sql = [
    "SELECT",
    `${sqlFieldExpression(nameField, "TEXT")} AS name,`,
    `${sqlFieldExpression(hucField, "TEXT")} AS huc,`,
    `${sqlFieldExpression(areaField, "REAL")} AS areasqkm,`,
    `CAST(COALESCE(${sqlFieldExpression(areaField, "REAL")}, 0) AS REAL) AS label_rank,`,
    `${sqlFieldExpression(statesField, "TEXT")} AS states,`,
    `${quoteSqlString(dataVersion)} AS data_version,`,
    `ST_PointOnSurface(${quoteSqlIdentifier(geometryField)}) AS geometry FROM ${quoteSqlIdentifier(sourceLayer)}`,
  ].join(" ");

  runCommand("ogr2ogr", [
    "-f",
    "GeoJSON",
    outputPath,
    ogrDataSourcePath,
    "-dialect",
    "SQLite",
    "-sql",
    sql,
  ]);
}

function buildLineFileFromSourceLayer(
  level: number,
  ogrDataSourcePath: string,
  sourceLayer: string,
  outputPath: string,
  dataVersion: string
): void {
  const geometryField = readOgrGeometryFieldName(ogrDataSourcePath, sourceLayer);
  const sql = [
    "SELECT",
    `${quoteSqlString(`huc${String(level)}`)} AS huc_level,`,
    `${quoteSqlString(dataVersion)} AS data_version,`,
    `${quoteSqlIdentifier(geometryField)} AS geometry`,
    `FROM ${quoteSqlIdentifier(sourceLayer)}`,
    `WHERE CAST(hudigit AS INTEGER) = ${String(level)}`,
  ].join(" ");

  runCommand("ogr2ogr", [
    "-f",
    "GeoJSON",
    outputPath,
    ogrDataSourcePath,
    "-dialect",
    "SQLite",
    "-sql",
    sql,
    "-nlt",
    "PROMOTE_TO_MULTI",
  ]);
}

function buildLineProperties(
  level: number,
  dataVersion: string
): Readonly<Record<string, unknown>> {
  return {
    data_version: dataVersion,
    huc_level: `huc${String(level)}`,
  };
}

function normalizePolygonCollection(
  collection: GeoJsonFeatureCollection,
  dataVersion: string
): GeoJsonFeatureCollection {
  const features = collection.features.reduce<GeoJsonFeature[]>((result, feature) => {
    const properties = feature.properties ?? {};
    result.push({
      geometry: feature.geometry,
      properties: {
        areasqkm: optionalNumber(properties.areasqkm),
        data_version: optionalString(properties.data_version) ?? dataVersion,
        huc: optionalString(properties.huc),
        name: optionalString(properties.name),
        states: optionalString(properties.states),
      },
      type: "Feature",
    });
    return result;
  }, []);

  return {
    features,
    type: "FeatureCollection",
  };
}

function normalizeDirectorySource(
  contextRunDir: string,
  directorySourcePath: string,
  dataVersion: string
): void {
  for (const level of HUC_LEVELS) {
    const polygonPath = resolvePolygonSourceFromDirectory(directorySourcePath, level);
    if (typeof polygonPath !== "string") {
      throw new Error(
        `Missing extracted hydro polygon source for huc${String(level)} in ${directorySourcePath}`
      );
    }

    const normalizedPolygons = normalizePolygonCollection(
      readGeoJsonFeatureCollection(polygonPath),
      dataVersion
    );
    const lineFeatures = buildBoundaryLineFeatures(
      normalizedPolygons,
      buildLineProperties(level, dataVersion)
    );
    writeFeatureCollection(
      join(contextRunDir, "normalized", `huc${String(level)}-line.geojson`),
      lineFeatures
    );

    if (level < 12) {
      buildLabelFileFromPolygonGeoJson(
        polygonPath,
        join(contextRunDir, "normalized", `huc${String(level)}-label.geojson`)
      );
    }
  }
}

function normalizeGpkgSource(
  contextRunDir: string,
  runConfig: RunConfigRecord,
  dataVersion: string
): void {
  const localSourcePath = resolveLocalSourcePath(join(contextRunDir, "raw"), runConfig);
  const ogrDataSourcePath = resolveOgrDataSourcePath(localSourcePath);
  const lineLayer = resolveOgrLayerName(ogrDataSourcePath, null, ["WBDLine"]);

  for (const level of HUC_LEVELS) {
    buildLineFileFromSourceLayer(
      level,
      ogrDataSourcePath,
      lineLayer,
      join(contextRunDir, "normalized", `huc${String(level)}-line.geojson`),
      dataVersion
    );

    if (level < 12) {
      buildLabelFileFromSourceLayer(
        level,
        ogrDataSourcePath,
        resolveSourceLayer(level, ogrDataSourcePath, runConfig.options),
        join(contextRunDir, "normalized", `huc${String(level)}-label.geojson`),
        dataVersion
      );
    }
  }
}

function normalizeStep(): void {
  const context = resolveRunContext("environmental-hydro-basins", import.meta.url);
  const dataVersion = readDataVersion(context.runSummaryPath, context.runId);
  const runConfig = readRunConfig(context.runConfigPath);
  const localSourcePath = resolveLocalSourcePath(context.rawDir, runConfig);

  if (existsSync(localSourcePath) && lstatSync(localSourcePath).isDirectory()) {
    normalizeDirectorySource(context.runDir, localSourcePath, dataVersion);
    return;
  }

  normalizeGpkgSource(context.runDir, runConfig, dataVersion);
}

const step = currentStep();
if (step === "extract") {
  extractStep();
} else if (step === "normalize") {
  normalizeStep();
} else {
  throw new Error(`Unsupported step: ${step}`);
}
