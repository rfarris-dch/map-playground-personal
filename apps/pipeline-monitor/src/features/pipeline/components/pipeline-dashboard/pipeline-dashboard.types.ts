import type { PipelineStatusResponse } from "@map-migration/contracts";
import type { ComputedRef } from "vue";
import type {
  PipelineDataset,
  PipelineFetchFailure,
  PipelineLiveEvent,
  PipelineStatusController,
} from "@/features/pipeline/pipeline.types";

type EstimatePipelineRate =
  typeof import("@/features/pipeline/pipeline-tracking/pipeline-tracking-rate.service").estimatePipelineRate;
type EstimateTileBuildRate =
  typeof import("@/features/pipeline/pipeline-tracking/pipeline-tracking-build-rate.service").estimateTileBuildRate;

export type PipelineDashboardResponse = PipelineStatusResponse;
export type PipelineDashboardRun = PipelineStatusResponse["run"];
export type PipelineDashboardState = PipelineDashboardRun["states"][number];
export type PipelineRateEstimate = ReturnType<EstimatePipelineRate>;
export type PipelineBuildRateEstimate = ReturnType<EstimateTileBuildRate>;

export interface DbLoadProgress {
  readonly activeWorkers: readonly string[];
  readonly completedStates: number | null;
  readonly currentFile: string | null;
  readonly loadedFiles: number | null;
  readonly percent: number | null;
  readonly stepKey: string;
  readonly stepLabel: string;
  readonly totalFiles: number | null;
  readonly totalStates: number | null;
}

export interface BuildProgress {
  readonly logBytes: number | null;
  readonly percent: number | null;
  readonly stage: "read" | "write" | "convert" | "complete" | null;
  readonly workDone: number | null;
  readonly workLeft: number | null;
  readonly workTotal: number | null;
}

export interface PipelineDashboardRunProgress {
  readonly expectedCount: number | null;
  readonly statesCompleted: number;
  readonly statesTotal: number;
  readonly writtenCount: number;
}

export interface PipelineDashboardStateRow extends PipelineDashboardState {
  readonly completionPercent: number | null;
  readonly expectedForDisplay: number | null;
  readonly remainingRows: number | null;
  readonly updatedAgeMs: number | null;
}

export interface PipelineDashboardFetchErrorAlertProps {
  readonly error: PipelineFetchFailure | null;
  readonly errorDetails: string | null;
}

export interface PipelineDashboardRunAlertsProps {
  readonly dataset: PipelineDataset;
  readonly noActiveSyncWarning: string | null;
  readonly partialStateWarning: string | null;
}

export interface PipelineDashboardSharedStatus {
  readonly autoRefresh: boolean;
  readonly consecutiveFailures: number;
  readonly isLoading: boolean;
  readonly lastRequestDurationMs: number | null;
  readonly pollingIntervalMs: number;
  readonly successfulRequests: number;
  readonly totalRequests: number;
}

export interface PipelineDashboardOverviewProps {
  readonly buildProgress: BuildProgress | null;
  readonly buildRateEstimate: PipelineBuildRateEstimate;
  readonly dataset: PipelineDataset;
  readonly dbLoadPercentLabel: string;
  readonly dbLoadProgress: DbLoadProgress | null;
  readonly isBuildLikelyStalled: boolean;
  readonly isLikelyStalled: boolean;
  readonly isMaterializeFinalizing: boolean;
  readonly isRunning: boolean;
  readonly lastSuccessAgeMs: number | null;
  readonly lastSuccessfulRefreshAt: string | null;
  readonly liveStatusLabel: string;
  readonly liveStatusTone: string;
  readonly nextPollInMs: number | null;
  readonly phaseTone: string;
  readonly rateEstimate: PipelineRateEstimate;
  readonly response: PipelineDashboardResponse | null;
  readonly responseAgeMs: number | null;
  readonly run: PipelineDashboardRun | null;
  readonly sharedStatus: PipelineDashboardSharedStatus;
  readonly stageSizeLabel: string | null;
  readonly successRatePercent: number;
}

export interface PipelineDashboardProgressProps {
  readonly activeMovingStateCodes: readonly string[];
  readonly buildProgress: BuildProgress | null;
  readonly buildProgressPercent: number;
  readonly buildRateEstimate: PipelineBuildRateEstimate;
  readonly dataset: PipelineDataset;
  readonly dbLoadDetailLabel: string;
  readonly dbLoadPercentLabel: string;
  readonly dbLoadProgress: DbLoadProgress | null;
  readonly displayedExpectedCount: number | null;
  readonly displayedStatesCompleted: number;
  readonly displayedStatesTotal: number;
  readonly displayedWrittenCount: number;
  readonly isBuildLikelyStalled: boolean;
  readonly isMaterializeFinalizing: boolean;
  readonly rowProgressPercent: number;
  readonly run: PipelineDashboardRun | null;
  readonly stageSizeLabel: string | null;
  readonly stateProgressPercent: number;
}

export interface PipelineDashboardDetailsProps {
  readonly response: PipelineDashboardResponse | null;
  readonly run: PipelineDashboardRun | null;
}

export interface PipelineDashboardStateEventsProps {
  readonly dataset: PipelineDataset;
  readonly eventFeedRows: readonly PipelineLiveEvent[];
  readonly stageSizeLabel: string | null;
  readonly stateRows: readonly PipelineDashboardStateRow[];
}

export interface PipelineDashboardLogTailProps {
  readonly logTailLines: readonly string[];
}

export interface PipelineDashboardModel {
  readonly activeMovingStateCodes: ComputedRef<readonly string[]>;
  readonly buildProgress: ComputedRef<BuildProgress | null>;
  readonly buildProgressPercent: ComputedRef<number>;
  readonly buildRateEstimate: ComputedRef<PipelineBuildRateEstimate>;
  readonly dataset: PipelineDataset;
  readonly dbLoadDetailLabel: ComputedRef<string>;
  readonly dbLoadPercentLabel: ComputedRef<string>;
  readonly dbLoadProgress: ComputedRef<DbLoadProgress | null>;
  readonly displayedExpectedCount: ComputedRef<number | null>;
  readonly displayedStatesCompleted: ComputedRef<number>;
  readonly displayedStatesTotal: ComputedRef<number>;
  readonly displayedWrittenCount: ComputedRef<number>;
  readonly errorDetails: ComputedRef<string | null>;
  readonly eventFeedRows: ComputedRef<readonly PipelineLiveEvent[]>;
  readonly isBuildLikelyStalled: ComputedRef<boolean>;
  readonly isLikelyStalled: ComputedRef<boolean>;
  readonly isMaterializeFinalizing: ComputedRef<boolean>;
  readonly isRunning: ComputedRef<boolean>;
  readonly lastSuccessAgeMs: ComputedRef<number | null>;
  readonly liveStatusLabel: ComputedRef<string>;
  readonly liveStatusTone: ComputedRef<string>;
  readonly logTailLines: ComputedRef<readonly string[]>;
  readonly nextPollInMs: ComputedRef<number | null>;
  readonly noActiveSyncWarning: ComputedRef<string | null>;
  onRefreshNow(): Promise<void>;
  onToggleAutoRefresh(nextChecked: boolean): void;
  readonly partialStateWarning: ComputedRef<string | null>;
  readonly phaseTone: ComputedRef<string>;
  readonly pipelineStatus: PipelineStatusController;
  readonly rateEstimate: ComputedRef<PipelineRateEstimate>;
  readonly response: ComputedRef<PipelineDashboardResponse | null>;
  readonly responseAgeMs: ComputedRef<number | null>;
  readonly rowProgressPercent: ComputedRef<number>;
  readonly run: ComputedRef<PipelineDashboardRun | null>;
  readonly stageSizeLabel: ComputedRef<string | null>;
  readonly stateProgressPercent: ComputedRef<number>;
  readonly stateRows: ComputedRef<readonly PipelineDashboardStateRow[]>;
  readonly successRatePercent: ComputedRef<number>;
}
