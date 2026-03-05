import {
  getParcelsSyncStatusStore,
  refreshParcelsSyncStatusStore,
} from "@/sync/parcels-sync/application/parcels-sync-store.service";
import type { ParcelsSyncStatusSnapshot } from "@/sync/parcels-sync.types";

export function getParcelsSyncStatusSnapshot(): ParcelsSyncStatusSnapshot {
  const statusStore = getParcelsSyncStatusStore();
  try {
    refreshParcelsSyncStatusStore();
  } catch (error) {
    console.error("[api] parcels sync status refresh failed", error);
  }

  return statusStore.snapshot();
}
