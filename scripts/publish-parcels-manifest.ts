#!/usr/bin/env bun
import { createHash } from "node:crypto";
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  buildTileLatestManifestPath,
  createManifestEntry,
  createPublishManifest,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
  type TilePublishManifest,
} from "@/packages/geo-tiles/src/index";
import type { CliArgs } from "./publish-parcels-manifest.types";

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

  const pmtilesPath = parseArg("--pmtiles-path");
  if (!pmtilesPath) {
    throw new Error("Missing --pmtiles-path=/absolute/or/relative/path/to/file.pmtiles");
  }

  const outputRoot = parseArg("--output-root") ?? "apps/web/public";
  const ingestionRunIdRaw = parseArg("--ingestion-run-id");
  const ingestionRunId =
    typeof ingestionRunIdRaw === "string" && ingestionRunIdRaw.trim().length > 0
      ? ingestionRunIdRaw.trim()
      : null;

  return {
    dataset,
    ingestionRunId,
    pmtilesPath: resolve(pmtilesPath),
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

function readExistingManifest(path: string): TilePublishManifest | null {
  if (!existsSync(path)) {
    return null;
  }

  const raw = readFileSync(path, "utf8");
  if (raw.trim().length === 0) {
    return null;
  }

  const parsed = JSON.parse(raw);
  return parseTilePublishManifest(parsed);
}

function writeManifest(path: string, manifest: TilePublishManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  const nextContent = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(path, nextContent, "utf8");
}

function copyPmtiles(sourcePath: string, destinationPath: string): void {
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (!existsSync(args.pmtilesPath)) {
    throw new Error(`PMTiles file not found: ${args.pmtilesPath}`);
  }

  const checksum = await sha256Hex(args.pmtilesPath);
  const entry = createManifestEntry(args.dataset, new Date(), checksum, {
    ingestionRunId: args.ingestionRunId ?? undefined,
  });

  const destinationPath = join(args.outputRoot, normalizeOutputRelativePath(entry.url));
  copyPmtiles(args.pmtilesPath, destinationPath);

  const latestRelativePath = buildTileLatestManifestPath(args.dataset);
  const latestPath = join(args.outputRoot, normalizeOutputRelativePath(latestRelativePath));
  const existingManifest = readExistingManifest(latestPath);
  const previous = existingManifest ? existingManifest.current : null;
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
