import { Effect } from "effect";
import { computed, onBeforeUnmount, shallowRef } from "vue";
import { useLatestEffectTask } from "@/composables/use-latest-effect-task";
import { cloneSelectionRing } from "@/features/selection/selection-analysis-request.service";
import {
  buildEmptySelectionToolSummary,
  exportSelectionToolSummary,
  querySelectionToolSummaryEffect,
} from "@/features/selection-tool/selection-tool.service";
import type {
  SelectionToolAnalysisSummary,
  SelectionToolProgress,
  UseSelectionToolOptions,
} from "@/features/selection-tool/selection-tool.types";

function buildSelectionRingKey(selectionRing: readonly [number, number][]): string {
  return selectionRing.map((vertex) => `${vertex[0].toFixed(6)},${vertex[1].toFixed(6)}`).join("|");
}

export function useSelectionTool(options: UseSelectionToolOptions) {
  const selectionProgress = shallowRef<SelectionToolProgress | null>(null);
  const selectionSummary = shallowRef<SelectionToolAnalysisSummary | null>(null);
  const selectionError = shallowRef<string | null>(null);
  const isSelectionLoading = shallowRef<boolean>(false);
  const selectionGeometry = shallowRef<readonly [number, number][] | null>(null);
  function resetSelectionTaskState(): void {
    isSelectionLoading.value = false;
    selectionError.value = null;
    selectionProgress.value = null;
  }
  const selectionTask = useLatestEffectTask({
    onClear: resetSelectionTaskState,
    onDispose: resetSelectionTaskState,
    onUnexpectedError(error) {
      resetSelectionTaskState();
      selectionError.value = "Unable to load spatial analysis summary.";
      console.error("[map] selection analysis refresh failed", error);
    },
  });

  const draftSelectionRing = computed(() => options.measureState.value.selectionRing);
  const hasCompletedDraftSelection = computed(
    () =>
      options.measureState.value.isSelectionComplete === true &&
      draftSelectionRing.value !== null &&
      draftSelectionRing.value.length >= 4
  );
  const isSelectionStale = computed(() => {
    const draft = draftSelectionRing.value;
    const analyzed = selectionGeometry.value;
    if (draft === null) {
      return false;
    }

    if (analyzed === null) {
      return true;
    }

    return buildSelectionRingKey(draft) !== buildSelectionRingKey(analyzed);
  });

  function logSelectionRunnerError(error: unknown): void {
    console.error("[map] selection analysis refresh failed", error);
  }

  async function analyzeCurrentSelection(): Promise<void> {
    const draft = draftSelectionRing.value;
    if (draft === null || !options.measureState.value.isSelectionComplete) {
      return;
    }

    const nextSelectionRing = cloneSelectionRing(draft);
    isSelectionLoading.value = true;
    selectionError.value = null;
    selectionProgress.value = null;
    selectionGeometry.value = cloneSelectionRing(nextSelectionRing);
    selectionSummary.value = buildEmptySelectionToolSummary(nextSelectionRing);

    await selectionTask.run(
      querySelectionToolSummaryEffect({
        expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
        includeParcels: options.includeParcels.value,
        onProgress(progress) {
          selectionProgress.value = progress;
        },
        selectionRing: nextSelectionRing,
        visiblePerspectives: options.visiblePerspectives.value,
      }).pipe(
        Effect.flatMap((queryResult) =>
          Effect.sync(() => {
            isSelectionLoading.value = false;

            if (!queryResult.ok) {
              selectionProgress.value = null;
              return;
            }

            selectionError.value = queryResult.value.errorMessage;
            selectionSummary.value = queryResult.value.summary;
          })
        )
      )
    );
  }

  async function clearSelectionResult(): Promise<void> {
    await selectionTask.clear();
    selectionGeometry.value = null;
    selectionSummary.value = null;
  }

  function exportSelectionSummary(): void {
    exportSelectionToolSummary(selectionSummary.value);
  }

  onBeforeUnmount(() => {
    selectionTask.dispose().catch(logSelectionRunnerError);
  });

  return {
    selectionGeometry,
    selectionProgress,
    selectionSummary,
    selectionError,
    isSelectionLoading,
    hasCompletedDraftSelection,
    isSelectionStale,
    analyzeCurrentSelection,
    clearSelectionResult,
    exportSelectionSummary,
  };
}
