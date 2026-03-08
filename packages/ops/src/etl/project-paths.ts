import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParcelSyncRuntimePaths } from "./project-paths.types";

export function resolveProjectRootFromFileUrl(fileUrl: string, levelsUp: number): string {
  const filePath = fileURLToPath(fileUrl);
  const relativeSegments = Array.from({ length: levelsUp }, () => "..");
  return resolve(dirname(filePath), ...relativeSegments);
}

export function defaultSnapshotRootForDataset(
  dataset: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (dataset === "environmental-flood") {
    return (
      env.ENVIRONMENTAL_FLOOD_SNAPSHOT_ROOT ??
      env.ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT ??
      join("var", "environmental-sync", "environmental-flood")
    );
  }

  if (dataset === "environmental-hydro-basins") {
    return (
      env.ENVIRONMENTAL_HYDRO_SNAPSHOT_ROOT ??
      env.ENVIRONMENTAL_SYNC_SNAPSHOT_ROOT ??
      join("var", "environmental-sync", "environmental-hydro-basins")
    );
  }

  return env.PARCEL_SYNC_OUTPUT_DIR ?? "var/parcels-sync";
}

export function defaultTilesOutDirForDataset(
  dataset: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (dataset === "environmental-flood") {
    return (
      env.ENVIRONMENTAL_FLOOD_TILES_OUT_DIR ??
      env.ENVIRONMENTAL_TILES_OUT_DIR ??
      join(".cache", "tiles", dataset)
    );
  }

  if (dataset === "environmental-hydro-basins") {
    return (
      env.ENVIRONMENTAL_HYDRO_TILES_OUT_DIR ??
      env.ENVIRONMENTAL_TILES_OUT_DIR ??
      join(".cache", "tiles", dataset)
    );
  }

  return env.PARCELS_TILES_OUT_DIR ?? join(".cache", "tiles", dataset);
}

export function resolveParcelsSyncRuntimePaths(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env
): ParcelSyncRuntimePaths {
  const rawSnapshotRoot = env.PARCEL_SYNC_OUTPUT_DIR;
  const snapshotRoot =
    typeof rawSnapshotRoot === "string" && rawSnapshotRoot.trim().length > 0
      ? resolve(projectRoot, rawSnapshotRoot.trim())
      : resolve(projectRoot, "var/parcels-sync");

  return {
    snapshotRoot,
    syncScriptPath: resolve(projectRoot, "scripts/refresh-parcels.sh"),
  };
}
