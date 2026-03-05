import { buildParcelsSyncConfig } from "@/sync/parcels-sync/config-env.service";
import { ParcelsSyncStatusStore } from "@/sync/parcels-sync/status-store.service";
import type { ParcelsSyncConfig } from "@/sync/parcels-sync.types";

const statusStore = new ParcelsSyncStatusStore(buildParcelsSyncConfig());

export function getParcelsSyncStatusStore(): ParcelsSyncStatusStore {
  return statusStore;
}

export function configureParcelsSyncStatusStore(config: ParcelsSyncConfig): void {
  statusStore.updateConfig(config);
  statusStore.refreshFromFilesystem();
}

export function refreshParcelsSyncStatusStore(): void {
  statusStore.refreshFromFilesystem();
}
