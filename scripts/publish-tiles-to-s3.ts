#!/usr/bin/env bun
import { execFileSync } from "node:child_process";
import { join, posix, resolve } from "node:path";
import {
  buildPmtilesPath,
  buildTileLatestManifestPath,
  parseTileDataset,
  parseTilePublishManifest,
  type TileDataset,
} from "@map-migration/geo-tiles";
import { fileExists, readJson } from "@map-migration/ops/etl/atomic-file-store";
import { findCliArgValue, trimToNull } from "@map-migration/ops/etl/cli-config";

const MANIFEST_CACHE_CONTROL = "public,max-age=60";
const PMTILES_CACHE_CONTROL = "public,max-age=31536000,immutable";
const LEADING_SLASHES_RE = /^\/+/;
const EDGE_SLASHES_RE = /^\/+|\/+$/g;

interface CliArgs {
  readonly bucket: string;
  readonly cloudfrontDistributionId: string | null;
  readonly dataset: TileDataset;
  readonly dryRun: boolean;
  readonly outputRoot: string;
  readonly prefix: string | null;
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

function parseCliArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const bucket = trimToNull(findCliArgValue(argv, "bucket"));
  if (bucket === null) {
    throw new Error("--bucket is required");
  }

  return {
    bucket,
    cloudfrontDistributionId: trimToNull(findCliArgValue(argv, "cloudfront-distribution-id")),
    dataset: parseDataset(findCliArgValue(argv, "dataset")),
    dryRun: trimToNull(findCliArgValue(argv, "dry-run")) === "1",
    outputRoot: resolve(findCliArgValue(argv, "output-root") ?? "apps/web/public"),
    prefix: trimToNull(findCliArgValue(argv, "prefix")),
  };
}

function normalizeRelativeKey(pathValue: string): string {
  const withoutLeadingSlash = pathValue.replace(LEADING_SLASHES_RE, "");
  if (withoutLeadingSlash.length === 0) {
    throw new Error(`Invalid S3 path: ${pathValue}`);
  }

  return withoutLeadingSlash;
}

function buildS3Key(relativePath: string, prefix: string | null): string {
  const normalizedRelativePath = normalizeRelativeKey(relativePath);
  if (prefix === null) {
    return normalizedRelativePath;
  }

  return posix.join(prefix.replace(EDGE_SLASHES_RE, ""), normalizedRelativePath);
}

function runAwsCommand(args: readonly string[], dryRun: boolean): void {
  const rendered = `aws ${args.join(" ")}`;
  if (dryRun) {
    console.log(`[tiles] dry-run ${rendered}`);
    return;
  }

  execFileSync("aws", args, {
    stdio: "inherit",
  });
}

function uploadObject(
  localPath: string,
  s3Uri: string,
  cacheControl: string,
  contentType: string,
  dryRun: boolean
): void {
  runAwsCommand(
    [
      "s3",
      "cp",
      localPath,
      s3Uri,
      "--cache-control",
      cacheControl,
      "--content-type",
      contentType,
      "--no-progress",
      "--only-show-errors",
    ],
    dryRun
  );
}

function invalidateManifestPath(
  distributionId: string | null,
  manifestPath: string,
  dryRun: boolean
): void {
  if (distributionId === null) {
    console.log(
      `[tiles] no CloudFront invalidation requested for ${manifestPath}; latest.json TTL contract remains ${MANIFEST_CACHE_CONTROL}`
    );
    return;
  }

  runAwsCommand(
    [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      manifestPath,
    ],
    dryRun
  );
}

function main(): void {
  const args = parseCliArgs();
  const manifestRelativePath = buildTileLatestManifestPath(args.dataset);
  const manifestPath = join(args.outputRoot, normalizeRelativeKey(manifestRelativePath));
  if (!fileExists(manifestPath)) {
    throw new Error(`Tile manifest does not exist: ${manifestPath}`);
  }

  const manifest = readJson(manifestPath, parseTilePublishManifest);
  const pmtilesRelativePath = buildPmtilesPath(args.dataset, manifest.current.version);
  const pmtilesPath = join(args.outputRoot, normalizeRelativeKey(pmtilesRelativePath));
  if (!fileExists(pmtilesPath)) {
    throw new Error(`PMTiles object does not exist: ${pmtilesPath}`);
  }

  const manifestS3Key = buildS3Key(manifestRelativePath, args.prefix);
  const pmtilesS3Key = buildS3Key(pmtilesRelativePath, args.prefix);
  const manifestS3Uri = `s3://${args.bucket}/${manifestS3Key}`;
  const pmtilesS3Uri = `s3://${args.bucket}/${pmtilesS3Key}`;

  uploadObject(
    pmtilesPath,
    pmtilesS3Uri,
    PMTILES_CACHE_CONTROL,
    "application/octet-stream",
    args.dryRun
  );
  uploadObject(
    manifestPath,
    manifestS3Uri,
    MANIFEST_CACHE_CONTROL,
    "application/json",
    args.dryRun
  );
  invalidateManifestPath(args.cloudfrontDistributionId, `/${manifestS3Key}`, args.dryRun);

  console.log("[tiles] published to S3");
  console.log(`dataset=${args.dataset}`);
  console.log(`manifest=${manifestS3Uri}`);
  console.log(`pmtiles=${pmtilesS3Uri}`);
}

if (import.meta.main) {
  main();
}
