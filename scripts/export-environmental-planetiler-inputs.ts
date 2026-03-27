#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  writeFloodPlanetilerInputs,
  writeHydroPlanetilerInputs,
} from "../packages/ops/src/etl/environmental-planetiler-inputs";
import { parseArg, resolveRunContext } from "./environmental/environmental-sync.service";

type EnvironmentalPlanetilerDataset = "environmental-flood" | "environmental-hydro-basins";

function readJsonRecord(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Invalid JSON object at ${path}`);
  }

  return parsed;
}

function requireDataset(): EnvironmentalPlanetilerDataset {
  const dataset = parseArg("--dataset");
  if (dataset !== "environmental-flood" && dataset !== "environmental-hydro-basins") {
    throw new Error(
      "Missing required argument --dataset=environmental-flood|environmental-hydro-basins"
    );
  }

  return dataset;
}

function requireLakeVersionRootPath(runSummaryPath: string): string {
  const explicitLakeVersionRoot = parseArg("--lake-version-root");
  if (typeof explicitLakeVersionRoot === "string" && explicitLakeVersionRoot.trim().length > 0) {
    const lakeVersionRoot = explicitLakeVersionRoot.trim();
    return isAbsolute(lakeVersionRoot) ? lakeVersionRoot : resolve(process.cwd(), lakeVersionRoot);
  }

  const runSummary = readJsonRecord(runSummaryPath);
  const geoParquetExport =
    runSummary !== null &&
    typeof runSummary.geoParquetExport === "object" &&
    runSummary.geoParquetExport !== null &&
    !Array.isArray(runSummary.geoParquetExport)
      ? runSummary.geoParquetExport
      : null;

  const lakeVersionRootPath =
    geoParquetExport !== null &&
    typeof geoParquetExport.lakeVersionRootPath === "string" &&
    geoParquetExport.lakeVersionRootPath.trim().length > 0
      ? geoParquetExport.lakeVersionRootPath.trim()
      : null;

  if (lakeVersionRootPath === null) {
    throw new Error(
      `Missing geoParquetExport.lakeVersionRootPath in ${runSummaryPath}. Run export-geoparquet before exporting Planetiler inputs.`
    );
  }

  return lakeVersionRootPath;
}

function resolveOutputRoot(dataset: EnvironmentalPlanetilerDataset, runId: string): string {
  const explicitOutputRoot = parseArg("--output-root");
  if (typeof explicitOutputRoot === "string" && explicitOutputRoot.trim().length > 0) {
    const outputRoot = explicitOutputRoot.trim();
    return isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot);
  }

  if (dataset === "environmental-flood") {
    return (
      process.env.ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT?.trim() ||
      join(process.cwd(), ".cache", "tilesources", dataset, runId)
    );
  }

  return (
    process.env.ENVIRONMENTAL_HYDRO_TILESOURCE_ROOT?.trim() ||
    join(process.cwd(), ".cache", "tilesources", dataset, runId)
  );
}

function resolveFloodOverlayKinds(): readonly ("100" | "500")[] {
  const rawOverlayKind =
    parseArg("--overlay-kind") ?? process.env.ENVIRONMENTAL_FLOOD_OVERLAY_KIND ?? "all";
  if (rawOverlayKind === "100" || rawOverlayKind === "500") {
    return [rawOverlayKind];
  }
  if (rawOverlayKind === "all") {
    return ["100", "500"];
  }

  throw new Error("Unsupported flood overlay kind. Expected 100, 500, or all.");
}

async function main(): Promise<void> {
  const dataset = requireDataset();
  const context = resolveRunContext(dataset, import.meta.url);
  const lakeVersionRootPath = requireLakeVersionRootPath(context.runSummaryPath);
  const outputRoot = resolveOutputRoot(dataset, context.runId);

  if (dataset === "environmental-flood") {
    const spec = await writeFloodPlanetilerInputs({
      context: {
        outputRoot,
        runDir: context.runDir,
        runDuckDbBootstrapPath: context.runDuckDbBootstrapPath,
        runDuckDbPath: context.runDuckDbPath,
      },
      lakeVersionRootPath,
      overlayKinds: resolveFloodOverlayKinds(),
    });

    console.error(
      `[planetiler-inputs] dataset=${dataset} runId=${context.runId} outputRoot=${outputRoot} overlays=${spec.outputs.map((output) => output.overlayKind).join(",")}`
    );
    return;
  }

  const spec = await writeHydroPlanetilerInputs({
    context: {
      outputRoot,
      runDir: context.runDir,
      runDuckDbBootstrapPath: context.runDuckDbBootstrapPath,
      runDuckDbPath: context.runDuckDbPath,
    },
    lakeVersionRootPath,
  });
  console.error(
    `[planetiler-inputs] dataset=${dataset} runId=${context.runId} outputRoot=${outputRoot} outputs=${String(spec.outputs.length)}`
  );
}

if (import.meta.main) {
  await main();
}
