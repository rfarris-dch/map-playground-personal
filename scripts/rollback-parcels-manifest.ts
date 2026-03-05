#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildTileLatestManifestPath,
  createPublishManifest,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
} from "@/packages/geo-tiles/src/index";
import type { CliArgs } from "./rollback-parcels-manifest.types";

const LEADING_SLASHES_RE = /^[/\\]+/;

function parseArg(name: string): string | null {
  const prefix = `${name}=`;
  for (const raw of process.argv.slice(2)) {
    if (raw.startsWith(prefix)) {
      return raw.slice(prefix.length);
    }
  }

  return null;
}

function parseDataset(raw: string | null): TileDataset {
  if (typeof raw === "string") {
    const parsed = parseTileDataset(raw);
    if (parsed !== null) {
      return parsed;
    }
  }

  throw new Error(
    "Missing or invalid --dataset. Expected one of: parcels, parcels-draw-v1, parcels-analysis-v1, infrastructure, power, telecom"
  );
}

function parseArgs(): CliArgs {
  const dataset = parseDataset(parseArg("--dataset"));
  const outputRoot = parseArg("--output-root") ?? "apps/web/public";

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
  if (!existsSync(latestPath)) {
    throw new Error(`Latest manifest does not exist: ${latestPath}`);
  }

  const raw = readFileSync(latestPath, "utf8");
  const parsed = JSON.parse(raw);
  const manifest = parseTilePublishManifest(parsed);
  if (manifest.previous === null) {
    throw new Error("Manifest has no previous entry to rollback to");
  }

  const rolledBackManifest = createPublishManifest(
    args.dataset,
    manifest.previous,
    manifest.current
  );

  writeFileSync(latestPath, `${JSON.stringify(rolledBackManifest, null, 2)}\n`, "utf8");

  console.log("[tiles] rollback complete");
  console.log(`dataset=${args.dataset}`);
  console.log(`current=${manifest.previous.version}`);
  console.log(`previous=${manifest.current.version}`);
}

main();
