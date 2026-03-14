import type { MapContextTransfer } from "@map-migration/http-contracts";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

export interface SpatialAnalysisDashboardBase {
  readonly createdAt: string;
  readonly isFiltered: boolean;
  readonly mapContext?: MapContextTransfer | undefined;
  readonly title: string;
}

export interface SpatialAnalysisMeasureDashboardState extends SpatialAnalysisDashboardBase {
  readonly source: "selection";
  readonly summary: SpatialAnalysisSummaryModel;
}

export interface SpatialAnalysisScannerDashboardState extends SpatialAnalysisDashboardBase {
  readonly source: "scanner";
  readonly summary: SpatialAnalysisSummaryModel;
}

export type SpatialAnalysisDashboardState =
  | SpatialAnalysisMeasureDashboardState
  | SpatialAnalysisScannerDashboardState;
