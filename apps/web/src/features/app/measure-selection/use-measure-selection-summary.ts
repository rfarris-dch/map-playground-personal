import { Effect } from "effect";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import {
  buildEmptyMeasureSelectionSummary,
  queryMeasureSelectionSummary,
} from "@/features/app/measure-selection/measure-selection.service";
import type { UseAppShellMeasureSelectionOptions } from "@/features/app/measure-selection/use-app-shell-measure-selection.types";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import { cloneSelectionRing } from "@/features/selection/selection-analysis-request.service";
import { createLatestRunner } from "@/lib/effect/latest-runner";

export function useMeasureSelectionSummary(options: UseAppShellMeasureSelectionOptions) {
  const measureSelectionSummary = shallowRef<MeasureSelectionSummary | null>(null);
  const measureSelectionError = shallowRef<string | null>(null);
  const isMeasureSelectionLoading = shallowRef<boolean>(false);
  const measureSelectionRunner = createLatestRunner({
    onUnexpectedError(error) {
      isMeasureSelectionLoading.value = false;
      measureSelectionError.value = "Unable to load measure selection summary.";
      measureSelectionSummary.value = null;
      console.error("[map] measure selection summary refresh failed", error);
    },
  });

  function logMeasureSelectionRunnerError(error: unknown): void {
    console.error("[map] measure selection summary refresh failed", error);
  }

  async function clearMeasureSelectionSummary(): Promise<void> {
    await measureSelectionRunner.interrupt();
    isMeasureSelectionLoading.value = false;
    measureSelectionError.value = null;
    measureSelectionSummary.value = null;
  }

  async function refreshMeasureSelectionSummary(): Promise<void> {
    if (options.outputMode.value !== "analysis") {
      await clearMeasureSelectionSummary();
      return;
    }

    const selectionRing = options.measureState.value.selectionRing;
    if (selectionRing === null) {
      await clearMeasureSelectionSummary();
      return;
    }

    const nextSelectionRing = cloneSelectionRing(selectionRing);

    isMeasureSelectionLoading.value = true;
    measureSelectionError.value = null;
    measureSelectionSummary.value = buildEmptyMeasureSelectionSummary(nextSelectionRing);

    await measureSelectionRunner.run(
      Effect.tryPromise({
        try: (signal) =>
          queryMeasureSelectionSummary({
            expectedParcelsIngestionRunId: options.expectedParcelsIngestionRunId.value,
            includeParcels: options.includeParcels.value,
            selectionRing: nextSelectionRing,
            visiblePerspectives: options.visiblePerspectives.value,
            signal,
          }),
        catch: (error) => error,
      }).pipe(
        Effect.flatMap((queryResult) =>
          Effect.sync(() => {
            isMeasureSelectionLoading.value = false;

            if (!queryResult.ok) {
              return;
            }

            measureSelectionError.value = queryResult.value.errorMessage;
            measureSelectionSummary.value = queryResult.value.summary;
          })
        )
      )
    );
  }

  watch(
    [
      () => options.measureState.value.selectionRing,
      () => options.expectedParcelsIngestionRunId.value,
      () => options.includeParcels.value,
      () => options.outputMode.value,
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
    measureSelectionRunner.dispose().catch(logMeasureSelectionRunnerError);
    isMeasureSelectionLoading.value = false;
    measureSelectionError.value = null;
  });

  return {
    measureSelectionSummary,
    measureSelectionError,
    isMeasureSelectionLoading,
  };
}
