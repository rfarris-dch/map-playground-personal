import { buildScannerCsv } from "@/features/scanner/scanner.service";
import type { ScannerSummary } from "@/features/scanner/scanner.types";
import { downloadCsvFile } from "@/lib/csv-download.service";

export function exportScannerSummary(scannerSummary: ScannerSummary): void {
  if (scannerSummary.totalCount === 0) {
    return;
  }

  const csv = buildScannerCsv(scannerSummary);
  downloadCsvFile(csv, "map-scanner");
}
