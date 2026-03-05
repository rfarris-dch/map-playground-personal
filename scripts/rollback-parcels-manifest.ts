#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildTileLatestManifestPath,
  type TileDataset,
  type TileManifestEntry,
} from "../packages/geo-tiles/src/index";

interface CliArgs {
  readonly dataset: TileDataset;
  readonly outputRoot: string;
}

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
  if (
    raw === "parcels" ||
    raw === "parcels-draw-v1" ||
    raw === "parcels-analysis-v1" ||
    raw === "infrastructure" ||
    raw === "power" ||
    raw === "telecom"
  ) {
    return raw;
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

function isEntry(value: unknown): value is TileManifestEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const dataset = Reflect.get(value, "dataset");
  const version = Reflect.get(value, "version");
  const checksum = Reflect.get(value, "checksum");
  const url = Reflect.get(value, "url");

  return (
    typeof dataset === "string" &&
    typeof version === "string" &&
    typeof checksum === "string" &&
    typeof url === "string"
  );
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
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Latest manifest is invalid JSON object");
  }

  const previous = Reflect.get(parsed, "previous");
  if (!isEntry(previous)) {
    throw new Error("Manifest has no previous entry to rollback to");
  }

  const current = Reflect.get(parsed, "current");
  if (!isEntry(current)) {
    throw new Error("Manifest current entry is invalid");
  }

  const rolledBackManifest = {
    dataset: args.dataset,
    publishedAt: new Date().toISOString(),
    current: previous,
    previous: current,
  };

  writeFileSync(latestPath, `${JSON.stringify(rolledBackManifest, null, 2)}\n`, "utf8");

  console.log("[tiles] rollback complete");
  console.log(`dataset=${args.dataset}`);
  console.log(`current=${previous.version}`);
  console.log(`previous=${current.version}`);
}

main();
