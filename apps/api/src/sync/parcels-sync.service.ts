import { startParcelsSyncLoop as startParcelsSyncLoopApplication } from "@/sync/parcels-sync/application/parcels-sync-loop.application.service";
import { getParcelsSyncStatusSnapshot as getParcelsSyncStatusSnapshotQuery } from "@/sync/parcels-sync/application/parcels-sync-status-query.service";
import type { ParcelsSyncController, ParcelsSyncStatusSnapshot } from "@/sync/parcels-sync.types";

// Public sync bounded-context entrypoint: delegates to application-layer use cases.
export function getParcelsSyncStatusSnapshot(): ParcelsSyncStatusSnapshot {
  return getParcelsSyncStatusSnapshotQuery();
}

export function startParcelsSyncLoop(): Promise<ParcelsSyncController> {
  return startParcelsSyncLoopApplication();
}
