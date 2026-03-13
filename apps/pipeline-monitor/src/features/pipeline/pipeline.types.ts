export type { PipelineDataset } from "@map-migration/contracts";

import type { PipelineStatusResponse } from "@map-migration/contracts";
import type { Ref } from "vue";

export interface PipelineStatusPayload {
  readonly requestId: string;
  readonly response: PipelineStatusResponse;
}

export type PipelineFetchFailureReason = "aborted" | "http" | "network" | "schema";

export interface PipelineFetchFailure {
  readonly details?: unknown;
  readonly message: string;
  readonly reason: PipelineFetchFailureReason;
  readonly requestId: string;
  readonly status?: number;
}

export interface PipelineLiveSample {
  readonly buildLogBytes: number | null;
  readonly buildProgressPercent: number | null;
  readonly capturedAt: string;
  readonly counterMode: "default" | "flood-staging-rows";
  readonly expectedCount: number | null;
  readonly isRunning: boolean;
  readonly lastStateUpdatedAt: string | null;
  readonly phase: PipelineStatusResponse["run"]["phase"];
  readonly rawWrittenCount: number;
  readonly requestId: string;
  readonly runId: string | null;
  readonly runStartedAt: string | null;
  readonly stageBytes: number | null;
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly writtenCount: number;
  readonly writtenUnit: "rows";
}

export type PipelineLiveEventTone = "critical" | "info" | "success";

export interface PipelineLiveEvent {
  readonly capturedAt: string;
  readonly message: string;
  readonly requestId: string;
  readonly tone: PipelineLiveEventTone;
}

export type PipelineStatusFetchResult =
  | {
      readonly ok: true;
      readonly payload: PipelineStatusPayload;
    }
  | {
      readonly ok: false;
      readonly error: PipelineFetchFailure;
    };

export interface PipelineStatusController {
  readonly autoRefresh: Ref<boolean>;
  readonly clockNowMs: Ref<number>;
  readonly consecutiveFailures: Ref<number>;
  readonly error: Ref<PipelineFetchFailure | null>;
  readonly events: Ref<readonly PipelineLiveEvent[]>;
  readonly history: Ref<readonly PipelineLiveSample[]>;
  readonly isLoading: Ref<boolean>;
  readonly lastFailedRefreshAt: Ref<string | null>;
  readonly lastFetchCompletedAt: Ref<string | null>;
  readonly lastFetchStartedAt: Ref<string | null>;
  readonly lastRequestDurationMs: Ref<number | null>;
  readonly lastSuccessfulRefreshAt: Ref<string | null>;
  readonly nextPollAt: Ref<string | null>;
  readonly payload: Ref<PipelineStatusPayload | null>;
  readonly pollingIntervalMs: Ref<number>;
  refreshNow(): Promise<void>;
  setAutoRefresh(nextValue: boolean): void;
  readonly successfulRequests: Ref<number>;
  readonly totalRequests: Ref<number>;
}
