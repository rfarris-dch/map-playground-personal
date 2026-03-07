import { onBeforeUnmount, shallowRef, watch } from "vue";
import type { UseAppShellSelectionAnalysisOptions } from "@/features/app/selection/use-app-shell-selection-analysis.types";
import {
  buildEmptySelectionToolSummary,
  exportSelectionToolSummary,
  querySelectionToolSummary,
} from "@/features/selection-tool/selection-tool.service";
import type {
  SelectionToolProgress,
  SelectionToolSummary,
} from "@/features/selection-tool/selection-tool.types";

export function useAppShellSelectionAnalysis(options: UseAppShellSelectionAnalysisOptions) {
  const selectionProgress = shallowRef<SelectionToolProgress | null>(null);
  const selectionSummary = shallowRef<SelectionToolSummary | null>(null);
  const selectionError = shallowRef<string | null>(null);
  const isSelectionLoading = shallowRef<boolean>(false);
  let selectionAbortController: AbortController | null = null;
  let selectionRequestSequence = 0;

  async function refreshSelectionSummary(): Promise<void> {
    const selectionGeometry = options.selectionGeometry.value;
    if (selectionGeometry === null) {
      selectionAbortController?.abort();
      selectionAbortController = null;
      selectionRequestSequence += 1;
      isSelectionLoading.value = false;
      selectionError.value = null;
      selectionProgress.value = null;
      selectionSummary.value = null;
      return;
    }

    selectionRequestSequence += 1;
    const requestSequence = selectionRequestSequence;
    selectionAbortController?.abort();
    const abortController = new AbortController();
    selectionAbortController = abortController;
    isSelectionLoading.value = true;
    selectionError.value = null;
    selectionProgress.value = null;
    selectionSummary.value = buildEmptySelectionToolSummary(selectionGeometry.ring);

    const queryResult = await querySelectionToolSummary({
      expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
      onProgress(progress) {
        if (requestSequence !== selectionRequestSequence) {
          return;
        }

        selectionProgress.value = progress;
      },
      selectionRing: selectionGeometry.ring,
      visiblePerspectives: options.visiblePerspectives.value,
      signal: abortController.signal,
    });

    if (requestSequence !== selectionRequestSequence) {
      return;
    }

    isSelectionLoading.value = false;
    if (!queryResult.ok) {
      selectionProgress.value = null;
      return;
    }

    selectionError.value = queryResult.value.errorMessage;
    selectionSummary.value = queryResult.value.summary;
  }

  watch(
    [
      () => options.selectionGeometry.value,
      () => options.expectedParcelsIngestionRunId.value,
      () => options.visiblePerspectives.value.colocation,
      () => options.visiblePerspectives.value.hyperscale,
    ],
    () => {
      refreshSelectionSummary().catch((error: unknown) => {
        console.error("[map] selection analysis refresh failed", error);
      });
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    selectionAbortController?.abort();
    selectionAbortController = null;
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
