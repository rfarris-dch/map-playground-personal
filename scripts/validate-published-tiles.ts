#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  assertTileManifestMatchesDataset,
  buildTileLatestManifestPath,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
} from "@map-migration/geo-tiles";
import { findCliArgValue } from "@map-migration/ops/etl/cli-config";

const LEADING_SLASHES_RE = /^[/\\]+/;

interface CliArgs {
  readonly dataset: TileDataset;
  readonly outputRoot: string;
}

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
  return {
    dataset: parseDataset(findCliArgValue(argv, "dataset")),
    outputRoot: resolve(findCliArgValue(argv, "output-root") ?? "apps/web/public"),
  };
}

function normalizeRelativeAssetPath(rawPath: string): string {
  const normalized = rawPath.replace(LEADING_SLASHES_RE, "");
  if (normalized.length === 0) {
    throw new Error(`Invalid asset path: ${rawPath}`);
  }

  return normalized;
}

function resolveAssetPath(outputRoot: string, assetUrl: string): string {
  if (assetUrl.startsWith("http://") || assetUrl.startsWith("https://")) {
    return join(outputRoot, normalizeRelativeAssetPath(new URL(assetUrl).pathname));
  }

  return join(outputRoot, normalizeRelativeAssetPath(assetUrl));
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

async function main(): Promise<void> {
  const args = parseArgs();
  const latestManifestPath = join(
    args.outputRoot,
    normalizeRelativeAssetPath(buildTileLatestManifestPath(args.dataset))
  );

  if (!existsSync(latestManifestPath)) {
    throw new Error(`Published manifest not found: ${latestManifestPath}`);
  }

  const manifest = parseTilePublishManifest(JSON.parse(readFileSync(latestManifestPath, "utf8")));
  assertTileManifestMatchesDataset(manifest, args.dataset, "local published tiles validation");

  const currentPmtilesPath = resolveAssetPath(args.outputRoot, manifest.current.url);
  if (!existsSync(currentPmtilesPath)) {
    throw new Error(`Published PMTiles artifact not found: ${currentPmtilesPath}`);
  }

  const checksum = await sha256Hex(currentPmtilesPath);
  if (checksum !== manifest.current.checksum) {
    throw new Error(
      `Published PMTiles checksum mismatch for ${currentPmtilesPath}: expected ${manifest.current.checksum}, received ${checksum}`
    );
  }

  console.log("[tiles] validated published tiles");
  console.log(`dataset=${args.dataset}`);
  console.log(`manifest=${latestManifestPath}`);
  console.log(`pmtiles=${currentPmtilesPath}`);
  console.log(`version=${manifest.current.version}`);
}

await main();
