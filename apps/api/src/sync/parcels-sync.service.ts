import { startParcelsSyncLoop as startParcelsSyncLoopApplication } from "@/sync/parcels-sync/application/parcels-sync-loop.application.service";
import type { ParcelsSyncController } from "@/sync/parcels-sync.types";

export function startParcelsSyncLoop(): Promise<ParcelsSyncController> {
  return startParcelsSyncLoopApplication();
}
