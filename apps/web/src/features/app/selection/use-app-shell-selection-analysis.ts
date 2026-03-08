import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import type { UseAppShellSelectionAnalysisOptions } from "@/features/app/selection/use-app-shell-selection-analysis.types";
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
import { mutateVueState } from "@/lib/effect/vue-bridge";

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

    isSelectionLoading.value = true;
    selectionError.value = null;
    selectionProgress.value = null;
    selectionSummary.value = buildEmptySelectionToolSummary(selectionGeometry.ring);

    await selectionRunner.run(
      querySelectionToolSummaryEffect({
        expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
        includeParcels: true,
        onProgress(progress) {
          selectionProgress.value = progress;
        },
        selectionRing: selectionGeometry.ring,
        visiblePerspectives: options.visiblePerspectives.value,
      }).pipe(
        Effect.flatMap((queryResult) =>
          mutateVueState(() => {
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
      () => options.visiblePerspectives.value.colocation,
      () => options.visiblePerspectives.value.hyperscale,
    ],
    () => {
      void refreshSelectionSummary();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    void selectionRunner.dispose();
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
