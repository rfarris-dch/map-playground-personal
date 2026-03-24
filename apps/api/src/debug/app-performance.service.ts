import type {
  AppPerformanceExportRequest,
  AppPerformanceIngestState,
} from "@map-migration/http-contracts/app-performance-http";

interface AppPerformanceIngestStore {
  exportCount: number;
  lastReceivedAt: string | null;
  latest: AppPerformanceExportRequest | null;
}

const state: AppPerformanceIngestStore = {
  exportCount: 0,
  lastReceivedAt: null,
  latest: null,
};

export function recordAppPerformanceExport(payload: AppPerformanceExportRequest): void {
  state.exportCount += 1;
  state.lastReceivedAt = new Date().toISOString();
  state.latest = payload;
}

export function getAppPerformanceIngestState(): AppPerformanceIngestState {
  return {
    exportCount: state.exportCount,
    generatedAt: new Date().toISOString(),
    lastReceivedAt: state.lastReceivedAt,
    latest: state.latest,
    status: "ok",
  };
}
