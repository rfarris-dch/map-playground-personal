import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  EnvironmentalDataset,
  EnvironmentalRunContext,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  LineStringGeometry,
  PointGeometry,
  Position,
  RunConfigRecord,
  SourceMaterializationResult,
} from "./environmental-sync.types";

interface OgrLayerFieldDefinition {
  readonly name?: unknown;
}

interface OgrGeometryFieldDefinition {
  readonly name?: unknown;
}

interface OgrLayerSummary {
  readonly featureCount?: unknown;
  readonly fields?: readonly OgrLayerFieldDefinition[];
  readonly geometryFields?: readonly OgrGeometryFieldDefinition[];
  readonly name?: unknown;
}

interface OgrInfoSummary {
  readonly layers?: readonly OgrLayerSummary[];
}

interface CommandOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

interface RunConfigInputs {
  readonly dataset: EnvironmentalDataset;
  readonly dataVersion: string;
  readonly options: Readonly<Record<string, string>>;
  readonly runId: string;
  readonly sourcePath: string | null;
  readonly sourceUrl: string | null;
}

interface SegmentRecord {
  readonly endKey: string;
  readonly endPosition: Position;
  readonly startKey: string;
  readonly startPosition: Position;
}

const ISO_MILLISECONDS_SUFFIX_PATTERN = /\.\d{3}Z$/;
const ISO_DATE_PARTS_PATTERN = /[-:]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatIsoTimestamp(date: Date): string {
  return date.toISOString().replace(ISO_MILLISECONDS_SUFFIX_PATTERN, "Z");
}

export function createRunId(date: Date = new Date()): string {
  return formatIsoTimestamp(date)
    .replace(ISO_DATE_PARTS_PATTERN, "")
    .replace(ISO_MILLISECONDS_SUFFIX_PATTERN, "Z");
}

export function parseArg(name: string): string | null {
  const prefix = `${name}=`;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) {
      return raw.slice(prefix.length);
    }
  }

  return null;
}

export function requireArg(name: string): string {
  const value = parseArg(name);
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required argument ${name}=...`);
  }

  return value.trim();
}

export function resolveProjectRoot(importMetaUrl: string): string {
  const scriptPath = fileURLToPath(importMetaUrl);
  return resolve(dirname(scriptPath), "..");
}

export function resolveRunContext(
  dataset: EnvironmentalDataset,
  importMetaUrl: string
): EnvironmentalRunContext {
  const projectRoot = resolveProjectRoot(importMetaUrl);
  const runId = parseArg("--run-id") ?? process.env.RUN_ID ?? createRunId();
  const datasetRoot = resolve(
    process.env.ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT ??
      join(projectRoot, "var", "environmental-sync", dataset)
  );
  const runDir = join(datasetRoot, runId);

  return {
    dataset,
    datasetRoot,
    latestRunPointerPath: join(datasetRoot, "latest.json"),
    normalizedDir: join(runDir, "normalized"),
    publishCompletePath: join(runDir, "publish-complete.json"),
    rawDir: join(runDir, "raw"),
    runConfigPath: join(runDir, "run-config.json"),
    runDir,
    runId,
    runSummaryPath: join(runDir, "run-summary.json"),
  };
}

export function ensureRunDirectories(context: EnvironmentalRunContext): void {
  mkdirSync(context.rawDir, { recursive: true });
  mkdirSync(context.normalizedDir, { recursive: true });
}

export function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tempPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tempPath, path);
}

export function writeRunConfig(path: string, input: RunConfigInputs): void {
  const record: RunConfigRecord = {
    createdAt: new Date().toISOString(),
    dataVersion: input.dataVersion,
    dataset: input.dataset,
    options: input.options,
    runId: input.runId,
    ...(typeof input.sourcePath === "string" ? { sourcePath: input.sourcePath } : {}),
    ...(typeof input.sourceUrl === "string" ? { sourceUrl: input.sourceUrl } : {}),
  };

  writeJsonFile(path, record);
}

function readExistingRunConfig(path: string): RunConfigRecord | null {
  if (!existsSync(path)) {
    return null;
  }

  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) {
    return null;
  }

  const parsed = JSON.parse(raw);
  if (!isRecord(parsed)) {
    return null;
  }

  const dataset = typeof parsed.dataset === "string" ? parsed.dataset : null;
  const runId = typeof parsed.runId === "string" ? parsed.runId : null;
  const dataVersion = typeof parsed.dataVersion === "string" ? parsed.dataVersion : null;
  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : null;
  const options = isRecord(parsed.options)
    ? Object.entries(parsed.options).reduce<Record<string, string>>((result, entry) => {
        const [key, value] = entry;
        if (typeof value === "string") {
          result[key] = value;
        }
        return result;
      }, {})
    : {};

  if (
    (dataset !== "environmental-flood" && dataset !== "environmental-hydro-basins") ||
    runId === null ||
    dataVersion === null ||
    createdAt === null
  ) {
    return null;
  }

  const sourcePath = typeof parsed.sourcePath === "string" ? parsed.sourcePath : undefined;
  const sourceUrl = typeof parsed.sourceUrl === "string" ? parsed.sourceUrl : undefined;

  return {
    createdAt,
    dataVersion,
    dataset,
    options,
    runId,
    ...(typeof sourcePath === "string" ? { sourcePath } : {}),
    ...(typeof sourceUrl === "string" ? { sourceUrl } : {}),
  };
}

export function verifyRunConfig(path: string, nextConfig: RunConfigInputs): void {
  const existing = readExistingRunConfig(path);
  if (existing === null) {
    return;
  }

  const expected = JSON.stringify(
    {
      dataVersion: nextConfig.dataVersion,
      dataset: nextConfig.dataset,
      options: nextConfig.options,
      sourcePath: nextConfig.sourcePath,
      sourceUrl: nextConfig.sourceUrl,
    },
    null,
    2
  );
  const actual = JSON.stringify(
    {
      dataVersion: existing.dataVersion,
      dataset: existing.dataset,
      options: existing.options,
      sourcePath: existing.sourcePath ?? null,
      sourceUrl: existing.sourceUrl ?? null,
    },
    null,
    2
  );

  if (actual !== expected) {
    throw new Error(
      `Saved run config does not match the current inputs for ${path}. Delete the run directory or reuse the original inputs.`
    );
  }
}

function runCommandInternal(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): string {
  const nextEnv = {
    ...process.env,
    ...options.env,
  };
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: nextEnv,
    encoding: "utf8",
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  if (typeof result.error !== "undefined") {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = [stdout.trim(), stderr.trim()].filter((value) => value.length > 0).join("\n");
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${String(result.status)}${
        detail.length > 0 ? `\n${detail}` : ""
      }`
    );
  }

  return stdout;
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: CommandOptions = {}
): string {
  return runCommandInternal(command, args, options);
}

function deriveDownloadFileName(sourceUrl: string, fallbackName: string): string {
  try {
    const url = new URL(sourceUrl);
    const name = basename(url.pathname);
    return name.length > 0 ? name : fallbackName;
  } catch {
    return fallbackName;
  }
}

export function materializeSource(
  rawDir: string,
  pathValue: string | null,
  urlValue: string | null,
  fallbackName: string
): SourceMaterializationResult {
  if (typeof pathValue === "string" && typeof urlValue === "string") {
    throw new Error("Set either a source path or a source URL, not both.");
  }

  if (typeof pathValue === "string") {
    const resolvedPath = resolve(pathValue);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Source path does not exist: ${resolvedPath}`);
    }

    const targetPath = join(rawDir, basename(resolvedPath));
    if (resolvedPath !== targetPath) {
      const sourceStats = lstatSync(resolvedPath);
      if (sourceStats.isDirectory()) {
        cpSync(resolvedPath, targetPath, { recursive: true });
      } else {
        cpSync(resolvedPath, targetPath);
      }
    }

    return {
      localPath: targetPath,
      sourcePath: resolvedPath,
      sourceUrl: null,
    };
  }

  if (typeof urlValue === "string") {
    const targetPath = join(rawDir, deriveDownloadFileName(urlValue, fallbackName));
    runCommand("curl", [
      "--fail",
      "--location",
      "--silent",
      "--show-error",
      "--output",
      targetPath,
      urlValue,
    ]);
    return {
      localPath: targetPath,
      sourcePath: null,
      sourceUrl: urlValue,
    };
  }

  throw new Error("Missing source input. Set the dataset-specific source path or source URL.");
}

export function resolveOgrDataSourcePath(path: string): string {
  const normalizedExtension = extname(path).toLowerCase();
  if (normalizedExtension === ".zip") {
    return `/vsizip/${resolve(path)}`;
  }

  return resolve(path);
}

function parseOgrInfoSummary(value: unknown): OgrInfoSummary {
  if (!isRecord(value)) {
    return {};
  }

  const layers = Array.isArray(value.layers)
    ? value.layers.filter(isRecord).map<OgrLayerSummary>((layer) => ({
        featureCount: Reflect.get(layer, "featureCount"),
        fields: Array.isArray(layer.fields)
          ? layer.fields.filter(isRecord).map<OgrLayerFieldDefinition>((field) => ({
              name: Reflect.get(field, "name"),
            }))
          : undefined,
        geometryFields: Array.isArray(layer.geometryFields)
          ? layer.geometryFields.filter(isRecord).map<OgrGeometryFieldDefinition>((field) => ({
              name: Reflect.get(field, "name"),
            }))
          : undefined,
        name: Reflect.get(layer, "name"),
      }))
    : undefined;

  return { layers };
}

function readOgrInfoSummary(dataSourcePath: string, layerName?: string): OgrInfoSummary {
  const args = ["-json", "-so", dataSourcePath];
  if (typeof layerName === "string" && layerName.trim().length > 0) {
    args.push(layerName);
  }

  const output = runCommand("ogrinfo", args);
  return parseOgrInfoSummary(JSON.parse(output));
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveOgrLayerName(
  dataSourcePath: string,
  explicitLayerName: string | null,
  candidates: readonly string[]
): string {
  if (typeof explicitLayerName === "string" && explicitLayerName.trim().length > 0) {
    return explicitLayerName.trim();
  }

  const summary = readOgrInfoSummary(dataSourcePath);
  const availableLayers =
    summary.layers?.reduce<string[]>((result, layer) => {
      if (typeof layer.name === "string" && layer.name.trim().length > 0) {
        result.push(layer.name.trim());
      }
      return result;
    }, []) ?? [];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLookupKey(candidate);
    const match = availableLayers.find(
      (layer) => normalizeLookupKey(layer) === normalizedCandidate
    );
    if (typeof match === "string") {
      return match;
    }
  }

  if (availableLayers.length === 1) {
    return availableLayers[0] ?? "";
  }

  throw new Error(
    `Unable to resolve OGR layer for ${dataSourcePath}. Available layers: ${availableLayers.join(", ")}`
  );
}

export function readOgrFieldNames(dataSourcePath: string, layerName: string): readonly string[] {
  const summary = readOgrInfoSummary(dataSourcePath, layerName);
  const layer = summary.layers?.[0];
  return (
    layer?.fields?.reduce<string[]>((result, field) => {
      if (typeof field.name === "string" && field.name.trim().length > 0) {
        result.push(field.name.trim());
      }
      return result;
    }, []) ?? []
  );
}

export function readOgrFeatureCount(dataSourcePath: string, layerName: string): number | null {
  const summary = readOgrInfoSummary(dataSourcePath, layerName);
  const featureCount = summary.layers?.[0]?.featureCount;

  return typeof featureCount === "number" && Number.isFinite(featureCount) ? featureCount : null;
}

export function readOgrGeometryFieldName(dataSourcePath: string, layerName: string): string {
  const summary = readOgrInfoSummary(dataSourcePath, layerName);
  const geometryField = summary.layers?.[0]?.geometryFields?.[0];

  if (typeof geometryField?.name === "string" && geometryField.name.trim().length > 0) {
    return geometryField.name.trim();
  }

  return "geometry";
}

export function resolveOgrFieldName(
  fieldNames: readonly string[],
  candidates: readonly string[],
  required: boolean
): string | null {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeLookupKey(candidate);
    const match = fieldNames.find(
      (fieldName) => normalizeLookupKey(fieldName) === normalizedCandidate
    );
    if (typeof match === "string") {
      return match;
    }
  }

  if (!required) {
    return null;
  }

  throw new Error(
    `Missing required field. Tried candidates ${candidates.join(", ")} against ${fieldNames.join(", ")}`
  );
}

export function quoteSqlIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function readGeoJsonFeatureCollection(path: string): GeoJsonFeatureCollection {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed) || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error(`Invalid GeoJSON FeatureCollection: ${path}`);
  }

  const features = parsed.features.reduce<GeoJsonFeature[]>((result, feature) => {
    if (isRecord(feature) && feature.type === "Feature") {
      const properties = isRecord(feature.properties) ? feature.properties : null;
      result.push({
        geometry: Reflect.get(feature, "geometry"),
        properties,
        type: "Feature",
      });
    }

    return result;
  }, []);

  return {
    features,
    type: "FeatureCollection",
  };
}

export function writeFeatureCollection(path: string, features: readonly GeoJsonFeature[]): void {
  writeJsonFile(path, {
    features,
    type: "FeatureCollection",
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readPosition(value: unknown): Position | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const x = value[0];
  const y = value[1];
  if (!(isFiniteNumber(x) && isFiniteNumber(y))) {
    return null;
  }

  return [x, y];
}

function readRing(value: unknown): readonly Position[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<Position[]>((result, coordinate) => {
    const position = readPosition(coordinate);
    if (position !== null) {
      result.push(position);
    }
    return result;
  }, []);
}

function collectPolygonRings(geometry: unknown): readonly (readonly Position[])[] {
  if (!isRecord(geometry) || typeof geometry.type !== "string") {
    return [];
  }

  if (geometry.type === "Polygon") {
    if (!Array.isArray(geometry.coordinates)) {
      return [];
    }

    return geometry.coordinates.reduce<Position[][]>((result, ring) => {
      const positions = readRing(ring);
      if (positions.length >= 4) {
        result.push(positions);
      }
      return result;
    }, []);
  }

  if (geometry.type === "MultiPolygon") {
    if (!Array.isArray(geometry.coordinates)) {
      return [];
    }

    return geometry.coordinates.reduce<Position[][]>((result, polygon) => {
      if (!Array.isArray(polygon)) {
        return result;
      }

      for (const ring of polygon) {
        const positions = readRing(ring);
        if (positions.length >= 4) {
          result.push(positions);
        }
      }

      return result;
    }, []);
  }

  return [];
}

function positionKey(position: Position): string {
  return `${position[0].toFixed(12)},${position[1].toFixed(12)}`;
}

function segmentKey(left: Position, right: Position): string {
  const leftKey = positionKey(left);
  const rightKey = positionKey(right);
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

function pushUniqueSegment(
  segments: Map<string, SegmentRecord>,
  start: Position,
  end: Position
): void {
  const key = segmentKey(start, end);
  if (segments.has(key)) {
    return;
  }

  segments.set(key, {
    endKey: positionKey(end),
    endPosition: end,
    startKey: positionKey(start),
    startPosition: start,
  });
}

function buildAdjacencyMap(segments: ReadonlyMap<string, SegmentRecord>): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const entry of segments) {
    const [segmentId, segment] = entry;
    const startBucket = adjacency.get(segment.startKey) ?? [];
    startBucket.push(segmentId);
    adjacency.set(segment.startKey, startBucket);

    const endBucket = adjacency.get(segment.endKey) ?? [];
    endBucket.push(segmentId);
    adjacency.set(segment.endKey, endBucket);
  }

  return adjacency;
}

function nextSegmentId(
  adjacency: ReadonlyMap<string, readonly string[]>,
  visited: ReadonlySet<string>,
  pointKey: string,
  currentSegmentId: string
): string | null {
  const candidates = adjacency.get(pointKey) ?? [];
  for (const candidate of candidates) {
    if (candidate !== currentSegmentId && !visited.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function walkMergedLine(
  segmentId: string,
  segments: ReadonlyMap<string, SegmentRecord>,
  adjacency: ReadonlyMap<string, readonly string[]>,
  visited: Set<string>
): readonly Position[] {
  const firstSegment = segments.get(segmentId);
  if (typeof firstSegment === "undefined") {
    return [];
  }

  const walkDirection = (
    initialPointKey: string,
    currentSegmentId: string
  ): readonly Position[] => {
    const positions: Position[] = [];
    let nextPointKey = initialPointKey;
    let activeSegmentId = currentSegmentId;

    while (true) {
      const degree = adjacency.get(nextPointKey)?.length ?? 0;
      if (degree !== 2) {
        break;
      }

      const nextId = nextSegmentId(adjacency, visited, nextPointKey, activeSegmentId);
      if (nextId === null) {
        break;
      }

      const nextSegment = segments.get(nextId);
      if (typeof nextSegment === "undefined") {
        break;
      }

      visited.add(nextId);
      activeSegmentId = nextId;

      if (nextSegment.startKey === nextPointKey) {
        nextPointKey = nextSegment.endKey;
        positions.push(nextSegment.endPosition);
      } else {
        nextPointKey = nextSegment.startKey;
        positions.push(nextSegment.startPosition);
      }
    }

    return positions;
  };

  visited.add(segmentId);
  const backward = walkDirection(firstSegment.startKey, segmentId);
  const forward = walkDirection(firstSegment.endKey, segmentId);

  return [
    ...backward.slice().reverse(),
    firstSegment.startPosition,
    firstSegment.endPosition,
    ...forward,
  ];
}

export function buildBoundaryLineFeatures(
  polygons: GeoJsonFeatureCollection,
  properties: Readonly<Record<string, unknown>>
): readonly GeoJsonFeature[] {
  const segments = new Map<string, SegmentRecord>();

  for (const feature of polygons.features) {
    const rings = collectPolygonRings(feature.geometry);
    for (const ring of rings) {
      for (let index = 1; index < ring.length; index += 1) {
        const start = ring[index - 1];
        const end = ring[index];
        if (typeof start === "undefined" || typeof end === "undefined") {
          continue;
        }
        pushUniqueSegment(segments, start, end);
      }
    }
  }

  const adjacency = buildAdjacencyMap(segments);
  const visited = new Set<string>();
  const features: GeoJsonFeature[] = [];

  appendBoundaryLineFeatures({
    adjacency,
    features,
    mode: "open",
    properties,
    segments,
    visited,
  });
  appendBoundaryLineFeatures({
    adjacency,
    features,
    mode: "closed",
    properties,
    segments,
    visited,
  });

  return features;
}

interface AppendBoundaryLineFeaturesInput {
  readonly adjacency: ReadonlyMap<string, readonly string[]>;
  readonly features: GeoJsonFeature[];
  readonly mode: "closed" | "open";
  readonly properties: Readonly<Record<string, unknown>>;
  readonly segments: ReadonlyMap<string, SegmentRecord>;
  readonly visited: Set<string>;
}

function pushLineFeature(
  features: GeoJsonFeature[],
  coordinates: readonly Position[],
  properties: Readonly<Record<string, unknown>>
): void {
  if (coordinates.length < 2) {
    return;
  }

  const geometry: LineStringGeometry = {
    coordinates,
    type: "LineString",
  };
  features.push({
    geometry,
    properties,
    type: "Feature",
  });
}

function isOpenBoundarySegment(
  segment: SegmentRecord,
  adjacency: ReadonlyMap<string, readonly string[]>
): boolean {
  const startDegree = adjacency.get(segment.startKey)?.length ?? 0;
  const endDegree = adjacency.get(segment.endKey)?.length ?? 0;
  return startDegree !== 2 || endDegree !== 2;
}

function appendBoundaryLineFeatures(input: AppendBoundaryLineFeaturesInput): void {
  for (const [segmentId, segment] of input.segments) {
    if (input.visited.has(segmentId)) {
      continue;
    }

    const isOpen = isOpenBoundarySegment(segment, input.adjacency);
    if ((input.mode === "open" && !isOpen) || (input.mode === "closed" && isOpen)) {
      continue;
    }

    const coordinates = walkMergedLine(segmentId, input.segments, input.adjacency, input.visited);
    pushLineFeature(input.features, coordinates, input.properties);
  }
}

export function buildPointFeature(
  coordinates: Position,
  properties: Readonly<Record<string, unknown>>
): GeoJsonFeature {
  const geometry: PointGeometry = {
    coordinates,
    type: "Point",
  };

  return {
    geometry,
    properties,
    type: "Feature",
  };
}

export function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function optionalNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}
