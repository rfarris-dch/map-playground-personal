import type { ManagedSyncChildProcess } from "@/sync/sync-loop-runtime.service";

export interface RunSyncScriptHooks {
  readonly onProcessExit?: () => void;
  readonly onProcessStart?: (process: ManagedSyncChildProcess) => void;
}
