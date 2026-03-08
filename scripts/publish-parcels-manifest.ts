#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildTileLatestManifestPath,
  createManifestEntry,
  createPublishManifest,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
  type TilePublishManifest,
} from "@map-migration/geo-tiles";
import {
  copyFileEnsuringDirectory,
  fileExists,
  readJsonOption,
  writeJsonAtomic,
} from "@map-migration/ops/etl/atomic-file-store";
import { findCliArgValue, trimToNull } from "@map-migration/ops/etl/cli-config";
import {
  defaultSnapshotRootForDataset,
  defaultTilesOutDirForDataset,
} from "@map-migration/ops/etl/project-paths";
import type { CliArgs } from "./publish-parcels-manifest.types";

const LEADING_SLASHES_RE = /^[/\\]+/;

function parseDataset(raw: string | null): TileDataset {
  if (typeof raw === "string") {
    const parsed = parseTileDataset(raw);
    if (parsed !== null) {
      return parsed;
    }
  }

  throw new Error(
    "Missing or invalid --dataset. Expected one of: parcels, parcels-draw-v1, parcels-analysis-v1, environmental-flood, environmental-hydro-basins, infrastructure, power, telecom"
  );
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const dataset = parseDataset(findCliArgValue(argv, "dataset"));
  const pmtilesPath = findCliArgValue(argv, "pmtiles-path");
  const outputRoot = findCliArgValue(argv, "output-root") ?? "apps/web/public";
  const runId = trimToNull(findCliArgValue(argv, "run-id"));
  const ingestionRunId = trimToNull(findCliArgValue(argv, "ingestion-run-id"));
  const snapshotRoot =
    findCliArgValue(argv, "snapshot-root") ?? defaultSnapshotRootForDataset(dataset);
  const tilesOutDir =
    findCliArgValue(argv, "tiles-out-dir") ?? defaultTilesOutDirForDataset(dataset);

  return {
    dataset,
    ingestionRunId,
    pmtilesPath: typeof pmtilesPath === "string" ? resolve(pmtilesPath) : null,
    outputRoot: resolve(outputRoot),
    runId,
    snapshotRoot: resolve(snapshotRoot),
    tilesOutDir: resolve(tilesOutDir),
  };
}

function normalizeOutputRelativePath(pathValue: string): string {
  const normalized = pathValue.replace(LEADING_SLASHES_RE, "");
  if (normalized.length === 0) {
    throw new Error(`Invalid output path: ${pathValue}`);
  }

  return normalized;
}

async function sha256Hex(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.on("end", () => {
      resolvePromise();
    });
    stream.on("error", (error) => {
      rejectPromise(error);
    });
  });

  return hash.digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readExistingManifest(path: string): TilePublishManifest | null {
  return readJsonOption(path, parseTilePublishManifest);
}

function writeManifest(path: string, manifest: TilePublishManifest): void {
  writeJsonAtomic(path, manifest);
}

function copyPmtiles(sourcePath: string, destinationPath: string): void {
  copyFileEnsuringDirectory(sourcePath, destinationPath);
}

function readLatestRunId(snapshotRoot: string): string | null {
  const latestPath = join(snapshotRoot, "latest.json");
  const parsed = readJsonOption(latestPath, (value) => value);
  if (!isRecord(parsed)) {
    return null;
  }

  const runId = Reflect.get(parsed, "runId");
  if (typeof runId !== "string" || runId.trim().length === 0) {
    return null;
  }

  return runId.trim();
}

function resolvePmtilesPath(args: CliArgs): {
  readonly ingestionRunId: string | null;
  readonly pmtilesPath: string;
} {
  if (typeof args.pmtilesPath === "string") {
    return {
      ingestionRunId: args.ingestionRunId,
      pmtilesPath: resolve(args.pmtilesPath),
    };
  }

  const resolvedRunId = args.runId ?? readLatestRunId(args.snapshotRoot);
  if (resolvedRunId === null) {
    throw new Error(
      `Missing --pmtiles-path and no latest run found under ${args.snapshotRoot}. Provide --pmtiles-path=/path/to/file.pmtiles or --run-id=<run-id>.`
    );
  }

  return {
    ingestionRunId: args.ingestionRunId ?? resolvedRunId,
    pmtilesPath: join(args.tilesOutDir, `${args.dataset}_${resolvedRunId}.pmtiles`),
  };
}

function manifestEntriesMatch(
  left: TilePublishManifest["current"],
  right: TilePublishManifest["current"]
): boolean {
  return (
    left.dataset === right.dataset &&
    left.checksum === right.checksum &&
    left.ingestionRunId === right.ingestionRunId &&
    left.url === right.url &&
    left.version === right.version
  );
}

async function main(): Promise<void> {
  const args = parseArgs();
  const resolvedInput = resolvePmtilesPath(args);

  if (!fileExists(resolvedInput.pmtilesPath)) {
    throw new Error(`PMTiles file not found: ${resolvedInput.pmtilesPath}`);
  }

  const checksum = await sha256Hex(resolvedInput.pmtilesPath);
  const entry = createManifestEntry(args.dataset, new Date(), checksum, {
    ingestionRunId: resolvedInput.ingestionRunId ?? undefined,
  });

  const latestRelativePath = buildTileLatestManifestPath(args.dataset);
  const latestPath = join(args.outputRoot, normalizeOutputRelativePath(latestRelativePath));
  const existingManifest = readExistingManifest(latestPath);
  if (existingManifest !== null && existingManifest.current.checksum === checksum) {
    const currentDestinationPath = join(
      args.outputRoot,
      normalizeOutputRelativePath(existingManifest.current.url)
    );
    if (!fileExists(currentDestinationPath)) {
      copyPmtiles(resolvedInput.pmtilesPath, currentDestinationPath);
    }

    console.log("[tiles] publish noop: current manifest already references this artifact");
    console.log(`dataset=${args.dataset}`);
    console.log(`version=${existingManifest.current.version}`);
    console.log(`url=${existingManifest.current.url}`);
    console.log(`latest=${latestRelativePath}`);
    return;
  }

  const destinationPath = join(args.outputRoot, normalizeOutputRelativePath(entry.url));
  copyPmtiles(resolvedInput.pmtilesPath, destinationPath);
  const previous =
    existingManifest !== null && !manifestEntriesMatch(existingManifest.current, entry)
      ? existingManifest.current
      : null;
  const nextManifest = createPublishManifest(args.dataset, entry, previous);

  writeManifest(latestPath, nextManifest);

  console.log("[tiles] published manifest");
  console.log(`dataset=${args.dataset}`);
  console.log(`version=${entry.version}`);
  console.log(`url=${entry.url}`);
  console.log(`latest=${latestRelativePath}`);
  if (typeof entry.ingestionRunId === "string") {
    console.log(`ingestionRunId=${entry.ingestionRunId}`);
  }
}

await main();
