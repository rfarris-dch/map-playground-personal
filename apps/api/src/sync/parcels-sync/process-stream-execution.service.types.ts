import type { ManagedSyncChildProcess } from "@/sync/parcels-sync/parcels-sync-runtime.types";

export interface OutputCaptureState {
  capturedBytes: number;
  output: string;
  truncated: boolean;
}

export interface ReadStreamOptions {
  readonly onLine?: (line: string) => void;
}

export interface RunSyncScriptHooks {
  readonly onProcessExit?: () => void;
  readonly onProcessStart?: (process: ManagedSyncChildProcess) => void;
}
