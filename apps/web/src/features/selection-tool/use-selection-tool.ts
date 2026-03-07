import { computed, onBeforeUnmount, shallowRef } from "vue";
import { cloneSelectionRing } from "@/features/selection/selection-analysis-request.service";
import {
  buildEmptySelectionToolSummary,
  exportSelectionToolSummary,
  querySelectionToolSummary,
} from "@/features/selection-tool/selection-tool.service";
import type {
  SelectionToolSummary,
  UseSelectionToolOptions,
} from "@/features/selection-tool/selection-tool.types";

function buildSelectionRingKey(selectionRing: readonly [number, number][]): string {
  return selectionRing.map((vertex) => `${vertex[0].toFixed(6)},${vertex[1].toFixed(6)}`).join("|");
}

export function useSelectionTool(options: UseSelectionToolOptions) {
  const selectionSummary = shallowRef<SelectionToolSummary | null>(null);
  const selectionError = shallowRef<string | null>(null);
  const isSelectionLoading = shallowRef<boolean>(false);
  const selectionGeometry = shallowRef<readonly [number, number][] | null>(null);
  let selectionAbortController: AbortController | null = null;
  let selectionRequestSequence = 0;

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

  async function analyzeCurrentSelection(): Promise<void> {
    const draft = draftSelectionRing.value;
    if (draft === null || !options.measureState.value.isSelectionComplete) {
      return;
    }

    const nextSelectionRing = cloneSelectionRing(draft);
    selectionRequestSequence += 1;
    const requestSequence = selectionRequestSequence;
    selectionAbortController?.abort();
    const abortController = new AbortController();
    selectionAbortController = abortController;
    isSelectionLoading.value = true;
    selectionError.value = null;
    selectionGeometry.value = nextSelectionRing;
    selectionSummary.value = buildEmptySelectionToolSummary(nextSelectionRing);

    const queryResult = await querySelectionToolSummary({
      expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
      selectionRing: nextSelectionRing,
      signal: abortController.signal,
      visiblePerspectives: options.visiblePerspectives.value,
    });

    if (requestSequence !== selectionRequestSequence) {
      return;
    }

    isSelectionLoading.value = false;
    if (!queryResult.ok) {
      return;
    }

    selectionError.value = queryResult.value.errorMessage;
    selectionSummary.value = queryResult.value.summary;
  }

  function clearSelectionResult(): void {
    selectionAbortController?.abort();
    selectionAbortController = null;
    selectionRequestSequence += 1;
    isSelectionLoading.value = false;
    selectionError.value = null;
    selectionGeometry.value = null;
    selectionSummary.value = null;
  }

  function exportSelectionSummary(): void {
    exportSelectionToolSummary(selectionSummary.value);
  }

  onBeforeUnmount(() => {
    selectionAbortController?.abort();
    selectionAbortController = null;
    isSelectionLoading.value = false;
    selectionError.value = null;
  });

  return {
    selectionGeometry,
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
