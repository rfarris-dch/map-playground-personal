import type { SpatialAnalysisHistoryResponse } from "@map-migration/http-contracts/spatial-analysis-history-http";

export type SpatialAnalysisHistoryModel = SpatialAnalysisHistoryResponse["summary"];
export type SpatialAnalysisHistoryPointModel = SpatialAnalysisHistoryModel["points"][number];

export type SpatialAnalysisHistorySeriesKey =
  | "colocationAvailableMw"
  | "colocationCommissionedMw"
  | "colocationPlannedMw"
  | "colocationUnderConstructionMw"
  | "hyperscaleOwnedMw"
  | "hyperscalePlannedMw"
  | "hyperscaleUnderConstructionMw"
  | "totalMarketSizeMw";

export interface SpatialAnalysisHistorySeriesDefinition {
  readonly color: string;
  readonly defaultVisible: boolean;
  readonly key: SpatialAnalysisHistorySeriesKey;
  readonly label: string;
}

export interface SpatialAnalysisHistoryChartLine {
  readonly axis: "primary" | "secondary";
  readonly color: string;
  readonly key: SpatialAnalysisHistorySeriesKey;
  readonly label: string;
  readonly path: string;
  readonly points: readonly {
    readonly x: number;
    readonly y: number;
  }[];
  readonly valueAtLatestPoint: number;
}

export interface SpatialAnalysisHistoryChartPoint {
  readonly label: string;
  readonly x: number;
}

export interface SpatialAnalysisHistoryChartTick {
  readonly axis: "primary" | "secondary";
  readonly label: string;
  readonly y: number;
}

export interface SpatialAnalysisHistoryChartModel {
  readonly lines: readonly SpatialAnalysisHistoryChartLine[];
  readonly points: readonly SpatialAnalysisHistoryChartPoint[];
  readonly ticks: readonly SpatialAnalysisHistoryChartTick[];
  readonly yMaxPrimary: number;
  readonly yMaxSecondary: number | null;
}
