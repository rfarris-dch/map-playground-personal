import { parseBooleanFlag, parseIntervalMilliseconds } from "@map-migration/ops/etl/cli-config";
import {
  resolveParcelsSyncRuntimePaths,
  resolveProjectRootFromFileUrl,
} from "@map-migration/ops/etl/project-paths";
import type { ParcelsSyncConfig, ParcelsSyncMode } from "@/sync/parcels-sync.types";

function defaultSyncMode(): ParcelsSyncMode {
  return process.env.NODE_ENV === "production" ? "external" : "in-process";
}

function parseSyncMode(value: string | undefined, enabled: boolean): ParcelsSyncMode {
  if (typeof value !== "string" || value.trim().length === 0) {
    if (!enabled) {
      return defaultSyncMode();
    }

    throw new Error("AUTO_PARCELS_SYNC_MODE is required when AUTO_PARCELS_SYNC is enabled");
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "external") {
    return "external";
  }
  if (normalized === "in-process") {
    return "in-process";
  }

  throw new Error(
    `AUTO_PARCELS_SYNC_MODE must be "external" or "in-process" (received "${value}")`
  );
}

export function buildParcelsSyncConfig(): ParcelsSyncConfig {
  const projectRoot = resolveProjectRootFromFileUrl(import.meta.url, 5);
  const runtimePaths = resolveParcelsSyncRuntimePaths(projectRoot);
  const enabled = parseBooleanFlag(process.env.AUTO_PARCELS_SYNC, false);

  return {
    enabled,
    intervalMs: parseIntervalMilliseconds(process.env.AUTO_PARCELS_SYNC_INTERVAL_SECONDS, 604_800),
    mode: parseSyncMode(process.env.AUTO_PARCELS_SYNC_MODE, enabled),
    requireStartupSuccess: parseBooleanFlag(process.env.AUTO_PARCELS_SYNC_STARTUP_REQUIRED, true),
    projectRoot,
    snapshotRoot: runtimePaths.snapshotRoot,
    syncScriptPath: runtimePaths.syncScriptPath,
  };
}
