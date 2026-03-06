import { buildMeasureSelectionCsv } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import { downloadCsvFile } from "@/lib/csv-download.service";

export function exportMeasureSelectionSummary(
  measureSelectionSummary: MeasureSelectionSummary | null
): void {
  if (measureSelectionSummary === null || measureSelectionSummary.totalCount === 0) {
    return;
  }

  const csv = buildMeasureSelectionCsv(measureSelectionSummary);
  downloadCsvFile(csv, "map-selection");
}
