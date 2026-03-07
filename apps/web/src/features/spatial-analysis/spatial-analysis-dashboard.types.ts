import type { MapContextTransfer } from "@map-migration/contracts";
import type { ScannerSummary } from "@/features/scanner/scanner.types";
import type { SelectionToolSummary } from "@/features/selection-tool/selection-tool.types";

export interface SpatialAnalysisDashboardBase {
  readonly createdAt: string;
  readonly isFiltered: boolean;
  readonly mapContext?: MapContextTransfer;
  readonly title: string;
}

export interface SpatialAnalysisMeasureDashboardState extends SpatialAnalysisDashboardBase {
  readonly source: "selection";
  readonly summary: SelectionToolSummary;
}

export interface SpatialAnalysisScannerDashboardState extends SpatialAnalysisDashboardBase {
  readonly source: "scanner";
  readonly summary: ScannerSummary;
}

export type SpatialAnalysisDashboardState =
  | SpatialAnalysisMeasureDashboardState
  | SpatialAnalysisScannerDashboardState;
