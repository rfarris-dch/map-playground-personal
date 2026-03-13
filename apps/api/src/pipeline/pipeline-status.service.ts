import {
  getPipelineDatasetDescriptor,
  type ParcelSyncProgress,
  type ParcelsSyncStatusResponse,
  PIPELINE_PLATFORM,
  type PipelineDataset,
  type PipelineStatusResponse,
} from "@map-migration/contracts";
import { getFloodSyncStatusSnapshot } from "@/geo/flood/flood-sync-status.service";
import { EXPOSE_SYNC_INTERNALS } from "@/geo/parcels/route/parcels-route-meta.service";
import { getParcelsSyncStatusSnapshot } from "@/sync/parcels-sync.service";
import type { ParcelsSyncRunProgress } from "@/sync/parcels-sync.types";
import { getHydroBasinsSyncStatusSnapshot } from "./hydro-basins-sync-status.service";

function sanitizeRunProgress(progress: ParcelsSyncRunProgress | null): ParcelSyncProgress | null {
  if (typeof progress === "undefined" || progress === null) {
    return null;
  }

  const dbLoad =
    typeof progress.dbLoad === "undefined"
      ? undefined
      : {
          ...progress.dbLoad,
          activeWorkers: [...(progress.dbLoad.activeWorkers ?? [])],
          currentFile: null,
        };

  if (EXPOSE_SYNC_INTERNALS) {
    return {
      schemaVersion: 1,
      phase: progress.phase,
      ...(typeof dbLoad === "undefined" ? {} : { dbLoad }),
      ...(typeof progress.tileBuild === "undefined"
        ? {}
        : { tileBuild: { ...progress.tileBuild } }),
    };
  }

  return {
    schemaVersion: 1,
    phase: progress.phase,
    ...(typeof dbLoad === "undefined" ? {} : { dbLoad }),
    ...(typeof progress.tileBuild === "undefined" ? {} : { tileBuild: { ...progress.tileBuild } }),
  };
}

function sanitizeParcelsStatus(
  syncStatus: ReturnType<typeof getParcelsSyncStatusSnapshot>
): ParcelsSyncStatusResponse {
  const run = syncStatus.run;

  return {
    status: "ok",
    generatedAt: new Date().toISOString(),
    enabled: syncStatus.enabled,
    mode: syncStatus.mode,
    intervalMs: syncStatus.intervalMs,
    requireStartupSuccess: syncStatus.requireStartupSuccess,
    snapshotRoot: EXPOSE_SYNC_INTERNALS ? syncStatus.snapshotRoot : "redacted",
    latestRunId: syncStatus.latestRunId,
    latestRunCompletedAt: syncStatus.latestRunCompletedAt,
    run: {
      ...run,
      summary: EXPOSE_SYNC_INTERNALS ? run.summary : null,
      progress: sanitizeRunProgress(run.progress ?? null),
      states: run.states.map((state) => ({
        ...state,
      })),
      logTail: EXPOSE_SYNC_INTERNALS ? [...run.logTail] : [],
    },
  };
}

export function getPipelineStatusPayload(
  dataset: PipelineDataset
): Promise<ParcelsSyncStatusResponse> {
  if (dataset === "parcels") {
    return Promise.resolve(sanitizeParcelsStatus(getParcelsSyncStatusSnapshot()));
  }

  if (dataset === "flood") {
    return getFloodSyncStatusSnapshot();
  }

  return Promise.resolve(getHydroBasinsSyncStatusSnapshot());
}

export async function getPipelineStatusResponse(
  dataset: PipelineDataset
): Promise<PipelineStatusResponse> {
  const payload = await getPipelineStatusPayload(dataset);

  return {
    ...payload,
    dataset: getPipelineDatasetDescriptor(dataset),
    platform: PIPELINE_PLATFORM,
  };
}
