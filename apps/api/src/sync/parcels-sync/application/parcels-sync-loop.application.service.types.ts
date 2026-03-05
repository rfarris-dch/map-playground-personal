import type { ParcelsSyncRuntimeState } from "@/sync/parcels-sync/parcels-sync-runtime.types";
import type { ParcelsSyncConfig } from "@/sync/parcels-sync.types";

export interface RunCycleArgs {
  readonly config: ParcelsSyncConfig;
  readonly failOnError: boolean;
  readonly reason: "interval" | "startup";
  readonly runtimeState: ParcelsSyncRuntimeState;
}
