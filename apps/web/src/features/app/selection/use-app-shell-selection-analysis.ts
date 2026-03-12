import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import type { UseAppShellSelectionAnalysisOptions } from "@/features/app/selection/use-app-shell-selection-analysis.types";
import { cloneSelectionRing } from "@/features/selection/selection-analysis-request.service";
import {
  buildEmptySelectionToolSummary,
  exportSelectionToolSummary,
  querySelectionToolSummaryEffect,
} from "@/features/selection-tool/selection-tool.service";
import type {
  SelectionToolAnalysisSummary,
  SelectionToolProgress,
} from "@/features/selection-tool/selection-tool.types";
import { createLatestRunner } from "@/lib/effect/latest-runner";

export function useAppShellSelectionAnalysis(options: UseAppShellSelectionAnalysisOptions) {
  const selectionProgress = shallowRef<SelectionToolProgress | null>(null);
  const selectionSummary = shallowRef<SelectionToolAnalysisSummary | null>(null);
  const selectionError = shallowRef<string | null>(null);
  const isSelectionLoading = shallowRef<boolean>(false);
  const selectionRunner = createLatestRunner({
    onUnexpectedError(error) {
      isSelectionLoading.value = false;
      selectionProgress.value = null;
      selectionError.value = "Unable to load spatial analysis summary.";
      console.error("[map] selection analysis refresh failed", error);
    },
  });

  function logSelectionRunnerError(error: unknown): void {
    console.error("[map] selection analysis refresh failed", error);
  }

  async function clearSelectionSummary(): Promise<void> {
    await selectionRunner.interrupt();
    isSelectionLoading.value = false;
    selectionError.value = null;
    selectionProgress.value = null;
    selectionSummary.value = null;
  }

  async function refreshSelectionSummary(): Promise<void> {
    const selectionGeometry = options.selectionGeometry.value;
    if (selectionGeometry === null) {
      await clearSelectionSummary();
      return;
    }

    const selectionRing = cloneSelectionRing(selectionGeometry.ring);

    isSelectionLoading.value = true;
    selectionError.value = null;
    selectionProgress.value = null;
    selectionSummary.value = buildEmptySelectionToolSummary(selectionRing);

    await selectionRunner.run(
      querySelectionToolSummaryEffect({
        expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
        includeParcels: options.includeParcels.value,
        onProgress(progress) {
          selectionProgress.value = progress;
        },
        selectionRing,
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

  watch(
    [
      () => options.selectionGeometry.value,
      () => options.expectedParcelsIngestionRunId.value,
      () => options.includeParcels.value,
      () => options.visiblePerspectives.value.colocation,
      () => options.visiblePerspectives.value.hyperscale,
    ],
    () => {
      refreshSelectionSummary().catch(logSelectionRunnerError);
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    selectionRunner.dispose().catch(logSelectionRunnerError);
    isSelectionLoading.value = false;
    selectionError.value = null;
    selectionProgress.value = null;
  });

  function exportSelection(): void {
    exportSelectionToolSummary(selectionSummary.value);
  }

  return {
    selectionProgress,
    selectionSummary,
    selectionError,
    isSelectionLoading,
    exportSelection,
  };
}
