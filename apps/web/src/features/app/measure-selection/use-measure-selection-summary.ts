import { onBeforeUnmount, shallowRef, watch } from "vue";
import {
  buildEmptyMeasureSelectionSummary,
  queryMeasureSelectionSummary,
} from "@/features/app/measure-selection/measure-selection.service";
import type { UseAppShellMeasureSelectionOptions } from "@/features/app/measure-selection/use-app-shell-measure-selection.types";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";

export function useMeasureSelectionSummary(options: UseAppShellMeasureSelectionOptions) {
  const measureSelectionSummary = shallowRef<MeasureSelectionSummary | null>(null);
  const measureSelectionError = shallowRef<string | null>(null);
  const isMeasureSelectionLoading = shallowRef<boolean>(false);
  let measureSelectionAbortController: AbortController | null = null;
  let measureSelectionRequestSequence = 0;

  async function refreshMeasureSelectionSummary(): Promise<void> {
    const selectionRing = options.measureState.value.selectionRing;
    if (selectionRing === null) {
      measureSelectionAbortController?.abort();
      measureSelectionAbortController = null;
      measureSelectionRequestSequence += 1;
      isMeasureSelectionLoading.value = false;
      measureSelectionError.value = null;
      measureSelectionSummary.value = null;
      return;
    }

    measureSelectionRequestSequence += 1;
    const requestSequence = measureSelectionRequestSequence;
    measureSelectionAbortController?.abort();
    const abortController = new AbortController();
    measureSelectionAbortController = abortController;
    isMeasureSelectionLoading.value = true;
    measureSelectionError.value = null;
    measureSelectionSummary.value = buildEmptyMeasureSelectionSummary(selectionRing);

    const queryResult = await queryMeasureSelectionSummary({
      expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
      selectionRing,
      visiblePerspectives: options.visiblePerspectives.value,
      signal: abortController.signal,
    });

    if (requestSequence !== measureSelectionRequestSequence) {
      return;
    }

    isMeasureSelectionLoading.value = false;
    if (!queryResult.ok) {
      return;
    }

    measureSelectionError.value = queryResult.value.errorMessage;
    measureSelectionSummary.value = queryResult.value.summary;
  }

  watch(
    [
      () => options.measureState.value.selectionRing,
      () => options.expectedParcelsIngestionRunId.value,
      () => options.visiblePerspectives.value.colocation,
      () => options.visiblePerspectives.value.hyperscale,
    ],
    () => {
      refreshMeasureSelectionSummary().catch((error: unknown) => {
        console.error("[map] measure selection summary refresh failed", error);
      });
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    measureSelectionAbortController?.abort();
    measureSelectionAbortController = null;
    isMeasureSelectionLoading.value = false;
    measureSelectionError.value = null;
  });

  return {
    measureSelectionSummary,
    measureSelectionError,
    isMeasureSelectionLoading,
  };
}
