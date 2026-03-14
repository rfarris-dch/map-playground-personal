import type { SpatialAnalysisSummaryRequest } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { ShallowRef } from "vue";
import type { PerspectiveVisibilityState } from "@/features/app/core/app-shell.types";
import type { MeasureState } from "@/features/measure/measure.types";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

export type SelectionToolSummary = SpatialAnalysisSummaryModel;
export type SelectionToolAnalysisSummary = SpatialAnalysisSummaryModel;

export type SelectionToolProgressStageKey = "facilities" | "markets" | "parcels";

export type SelectionToolProgressStageStatus =
  | "complete"
  | "error"
  | "pending"
  | "running"
  | "skipped";

export interface SelectionToolProgressStage {
  readonly completedWork: number;
  readonly detail: string | null;
  readonly key: SelectionToolProgressStageKey;
  readonly label: string;
  readonly status: SelectionToolProgressStageStatus;
  readonly totalWork: number | null;
}

export interface SelectionToolProgress {
  readonly activeStageKey: SelectionToolProgressStageKey | null;
  readonly completedStageCount: number;
  readonly percent: number;
  readonly stages: readonly SelectionToolProgressStage[];
  readonly totalStageCount: number;
}

export interface QuerySelectionToolSummaryArgs {
  readonly expectedParcelsIngestionRunId: string | null;
  readonly includeParcels?: boolean;
  readonly minimumMarketSelectionOverlapPercent?: number;
  readonly onProgress?: (progress: SelectionToolProgress) => void;
  readonly selectionRing: readonly [number, number][];
  readonly signal?: AbortSignal;
  readonly visiblePerspectives: PerspectiveVisibilityState;
}

export type QuerySelectionToolSummaryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly errorMessage: string | null;
        readonly summary: SelectionToolAnalysisSummary;
      };
    }
  | { readonly ok: false; readonly reason: "aborted" };

export interface UseSelectionToolOptions {
  readonly expectedParcelsIngestionRunId: ShallowRef<string | null>;
  readonly includeParcels: ShallowRef<boolean>;
  readonly measureState: ShallowRef<MeasureState>;
  readonly visiblePerspectives: ShallowRef<PerspectiveVisibilityState>;
}

export type SpatialAnalysisSummaryRequestInput = SpatialAnalysisSummaryRequest;
