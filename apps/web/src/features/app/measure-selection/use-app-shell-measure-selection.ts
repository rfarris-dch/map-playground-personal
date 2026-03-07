import { shallowRef, watch } from "vue";
import {
  exportMeasureSelectionImage,
  exportMeasureSelectionSummary,
} from "@/features/app/measure-selection/measure-selection-export.service";
import type { UseAppShellMeasureSelectionOptions } from "@/features/app/measure-selection/use-app-shell-measure-selection.types";
import { useMeasureSelectionSummary } from "@/features/app/measure-selection/use-measure-selection-summary";

function buildSelectionRingKey(selectionRing: readonly [number, number][]): string {
  return selectionRing.map((vertex) => `${vertex[0].toFixed(6)},${vertex[1].toFixed(6)}`).join("|");
}

export function useAppShellMeasureSelection(options: UseAppShellMeasureSelectionOptions) {
  const measureSelection = useMeasureSelectionSummary(options);
  const lastExportedSelectionKey = shallowRef<string | null>(null);

  watch(
    [
      () => options.map.value,
      () => options.measureState.value.isSelectionComplete,
      () => options.measureState.value.selectionRing,
      () => options.imageSubject.value,
      () => options.outputMode.value,
    ],
    ([map, isSelectionComplete, selectionRing, imageSubject, outputMode]) => {
      if (selectionRing === null || outputMode !== "image") {
        lastExportedSelectionKey.value = null;
        return;
      }

      if (!isSelectionComplete || map === null) {
        return;
      }

      const selectionRingKey = `${buildSelectionRingKey(selectionRing)}:${imageSubject}`;
      if (lastExportedSelectionKey.value === selectionRingKey) {
        return;
      }

      lastExportedSelectionKey.value = selectionRingKey;
      exportMeasureSelectionImage({
        map,
        selectionRing,
        subject: imageSubject,
      }).catch((error: unknown) => {
        lastExportedSelectionKey.value = null;
        console.error("[map] measure selection image export failed", error);
      });
    },
    { immediate: true }
  );

  function exportMeasureSelection(): void {
    exportMeasureSelectionSummary(measureSelection.measureSelectionSummary.value);
  }

  return {
    measureSelectionSummary: measureSelection.measureSelectionSummary,
    measureSelectionError: measureSelection.measureSelectionError,
    isMeasureSelectionLoading: measureSelection.isMeasureSelectionLoading,
    exportMeasureSelection,
  };
}
