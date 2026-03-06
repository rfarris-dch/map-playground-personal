import {
  getParcelsSyncStatusStore,
  refreshParcelsSyncStatusStore,
} from "@/sync/parcels-sync/application/parcels-sync-store.service";
import type { ParcelsSyncStatusSnapshot } from "@/sync/parcels-sync.types";

export function getParcelsSyncStatusSnapshot(): ParcelsSyncStatusSnapshot {
  const statusStore = getParcelsSyncStatusStore();
  refreshParcelsSyncStatusStore();
  return statusStore.snapshot();
}
