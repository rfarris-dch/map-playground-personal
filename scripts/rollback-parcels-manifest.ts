#!/usr/bin/env bun
import { join, resolve } from "node:path";
import {
  buildTileLatestManifestPath,
  createPublishManifest,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
} from "@map-migration/geo-tiles";
import { fileExists, readJson, writeJsonAtomic } from "@map-migration/ops/etl/atomic-file-store";
import { findCliArgValue } from "@map-migration/ops/etl/cli-config";
import type { CliArgs } from "./rollback-parcels-manifest.types";

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
  const outputRoot = findCliArgValue(argv, "output-root") ?? "apps/web/public";

  return {
    dataset,
    outputRoot: resolve(outputRoot),
  };
}

function normalizeOutputRelativePath(pathValue: string): string {
  const normalized = pathValue.replace(LEADING_SLASHES_RE, "");
  if (normalized.length === 0) {
    throw new Error(`Invalid output path: ${pathValue}`);
  }

  return normalized;
}

function main(): void {
  const args = parseArgs();

  const latestPath = join(
    args.outputRoot,
    normalizeOutputRelativePath(buildTileLatestManifestPath(args.dataset))
  );
  if (!fileExists(latestPath)) {
    throw new Error(`Latest manifest does not exist: ${latestPath}`);
  }

  const manifest = readJson(latestPath, parseTilePublishManifest);
  if (manifest.previous === null) {
    throw new Error("Manifest has no previous entry to rollback to");
  }

  const rollbackTargetPath = join(
    args.outputRoot,
    normalizeOutputRelativePath(manifest.previous.url)
  );
  if (!fileExists(rollbackTargetPath)) {
    throw new Error(`Rollback target PMTiles does not exist: ${rollbackTargetPath}`);
  }

  const rolledBackManifest = createPublishManifest(
    args.dataset,
    manifest.previous,
    manifest.current
  );
  writeJsonAtomic(latestPath, rolledBackManifest);

  console.log("[tiles] rollback complete");
  console.log(`dataset=${args.dataset}`);
  console.log(`current=${manifest.previous.version}`);
  console.log(`previous=${manifest.current.version}`);
}

main();
