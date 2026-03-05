import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParcelsSyncConfig, ParcelsSyncMode } from "../parcels-sync.types";

function parseBooleanFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "0" || normalized === "false" || normalized === "off" || normalized === "no") {
    return false;
  }

  if (normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes") {
    return true;
  }

  return defaultValue;
}

function parseIntervalMilliseconds(value: string | undefined, defaultSeconds: number): number {
  if (!value) {
    return defaultSeconds * 1000;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultSeconds * 1000;
  }

  return Math.floor(parsed * 1000);
}

function parseSyncMode(value: string | undefined): ParcelsSyncMode {
  if (typeof value !== "string") {
    return process.env.NODE_ENV === "production" ? "external" : "in-process";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "external") {
    return "external";
  }
  if (normalized === "in-process") {
    return "in-process";
  }

  return process.env.NODE_ENV === "production" ? "external" : "in-process";
}

function parseSnapshotRoot(projectRoot: string): string {
  const rawSnapshotRoot = process.env.PARCEL_SYNC_OUTPUT_DIR;
  if (typeof rawSnapshotRoot !== "string" || rawSnapshotRoot.trim().length === 0) {
    return resolve(projectRoot, "var/parcels-sync");
  }

  return resolve(projectRoot, rawSnapshotRoot.trim());
}

export function buildParcelsSyncConfig(): ParcelsSyncConfig {
  const serviceFilePath = fileURLToPath(import.meta.url);
  const serviceDirectory = dirname(serviceFilePath);
  const projectRoot = resolve(serviceDirectory, "../../../../../");
  const syncScriptPath = resolve(projectRoot, "scripts/refresh-parcels.sh");
  const snapshotRoot = parseSnapshotRoot(projectRoot);

  return {
    enabled: parseBooleanFlag(process.env.AUTO_PARCELS_SYNC, false),
    intervalMs: parseIntervalMilliseconds(process.env.AUTO_PARCELS_SYNC_INTERVAL_SECONDS, 604_800),
    mode: parseSyncMode(process.env.AUTO_PARCELS_SYNC_MODE),
    requireStartupSuccess: parseBooleanFlag(process.env.AUTO_PARCELS_SYNC_STARTUP_REQUIRED, true),
    projectRoot,
    snapshotRoot,
    syncScriptPath,
  };
}
