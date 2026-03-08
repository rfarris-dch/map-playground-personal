import type { ManagedSyncChildProcess } from "@/sync/parcels-sync/parcels-sync-runtime.types";

export interface RunSyncScriptHooks {
  readonly onProcessExit?: () => void;
  readonly onProcessStart?: (process: ManagedSyncChildProcess) => void;
}
