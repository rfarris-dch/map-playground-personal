import { exportMeasureSelectionSummary } from "@/features/app/measure-selection/measure-selection-export.service";
import type { UseAppShellMeasureSelectionOptions } from "@/features/app/measure-selection/use-app-shell-measure-selection.types";
import { useMeasureSelectionSummary } from "@/features/app/measure-selection/use-measure-selection-summary";

export function useAppShellMeasureSelection(options: UseAppShellMeasureSelectionOptions) {
  const measureSelection = useMeasureSelectionSummary(options);

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
