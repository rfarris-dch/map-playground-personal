#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { validateEnvironmentalFloodTileInputs } from "../packages/ops/src/etl/environmental-flood-parity";
import {
  parseArg,
  resolveRunContext,
  writeJsonFile,
} from "./environmental/environmental-sync.service";

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

function resolveOutputRoot(runId: string): string {
  const explicitOutputRoot = parseArg("--output-root");
  if (typeof explicitOutputRoot === "string" && explicitOutputRoot.trim().length > 0) {
    const outputRoot = explicitOutputRoot.trim();
    return isAbsolute(outputRoot) ? outputRoot : resolve(process.cwd(), outputRoot);
  }

  return (
    process.env.ENVIRONMENTAL_FLOOD_TILESOURCE_ROOT?.trim() ||
    join(process.cwd(), ".cache", "tilesources", "environmental-flood", runId)
  );
}

function resolveOverlayKinds(): readonly ("100" | "500")[] {
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

function requireDataVersion(context: ReturnType<typeof resolveRunContext>): string {
  const runConfig = readJsonRecord(context.runConfigPath);
  const dataVersion = runConfig?.dataVersion;
  if (typeof dataVersion !== "string" || dataVersion.trim().length === 0) {
    throw new Error(`Missing dataVersion in ${context.runConfigPath}`);
  }

  return dataVersion.trim();
}

function computeFileSha256(path: string): string {
  const digest = createHash("sha256");
  digest.update(readFileSync(path));
  return digest.digest("hex");
}

function buildOverlayArtifacts(args: {
  readonly outputRoot: string;
  readonly overlayKinds: readonly ("100" | "500")[];
}): readonly Record<string, string | number>[] {
  return args.overlayKinds.map((overlayKind) => {
    const path = join(args.outputRoot, `flood-overlay-${overlayKind}.gpkg`);
    if (!existsSync(path)) {
      throw new Error(`Missing validated flood overlay artifact: ${path}`);
    }

    const stats = statSync(path);
    if (!stats.isFile() || stats.size <= 0) {
      throw new Error(`Invalid validated flood overlay artifact: ${path}`);
    }

    return {
      modifiedAt: stats.mtime.toISOString(),
      overlayKind,
      path,
      sha256: computeFileSha256(path),
      sizeBytes: stats.size,
    };
  });
}

async function main(): Promise<void> {
  const context = resolveRunContext("environmental-flood", import.meta.url);
  const outputRoot = resolveOutputRoot(context.runId);
  const overlayKinds = resolveOverlayKinds();
  const currentRunSummary = readJsonRecord(context.runSummaryPath) ?? {};
  const parityResult = await validateEnvironmentalFloodTileInputs({
    context,
    dataVersion: requireDataVersion(context),
    outputRoot,
    overlayKinds,
  });
  const overlayArtifacts = buildOverlayArtifacts({
    outputRoot,
    overlayKinds,
  });

  writeJsonFile(context.runSummaryPath, {
    ...currentRunSummary,
    tileInputParity: {
      failedAssertions: parityResult.failedAssertions,
      overlayArtifacts,
      outputRoot,
      overlayKinds,
      qaAssertionsPath: parityResult.qaAssertionsPath,
      qaProfilePath: parityResult.qaProfilePath,
      status: parityResult.passed ? "passed" : "failed",
      targetNames: parityResult.targetNames,
      validatedAt: parityResult.validatedAt,
    },
  });

  if (!parityResult.passed) {
    throw new Error(
      `environmental flood tile-input parity failed with ${String(parityResult.failedAssertions)} blocking assertions`
    );
  }

  console.error(
    `[tilesource] flood parity passed runId=${context.runId} overlays=${overlayKinds.join(",")} qa=${context.qaAssertionsPath}`
  );
}

if (import.meta.main) {
  await main();
}
