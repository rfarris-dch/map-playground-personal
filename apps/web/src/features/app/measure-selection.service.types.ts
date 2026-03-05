import type { PerspectiveVisibilityState } from "@/features/app/app-shell.types";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";

export type QueryMeasureSelectionSummaryResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly errorMessage: string | null;
        readonly summary: MeasureSelectionSummary;
      };
    }
  | { readonly ok: false; readonly reason: "aborted" };

export interface QueryMeasureSelectionSummaryArgs {
  readonly selectionRing: readonly [number, number][];
  readonly signal: AbortSignal;
  readonly visiblePerspectives: PerspectiveVisibilityState;
}
