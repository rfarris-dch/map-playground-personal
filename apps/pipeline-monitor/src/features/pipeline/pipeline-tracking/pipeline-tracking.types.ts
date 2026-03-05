export interface PipelineRateEstimate {
  readonly averageRowsPerSecond: number | null;
  readonly etaMs: number | null;
  readonly rateBasis: "average" | "recent" | null;
  readonly recentRowsPerSecond: number | null;
  readonly remainingRows: number | null;
  readonly rowsPerSecond: number | null;
  readonly stalledMs: number | null;
}

export interface PipelineBuildEstimate {
  readonly averagePercentPerSecond: number | null;
  readonly etaMs: number | null;
  readonly percentPerSecond: number | null;
  readonly rateBasis: "average" | "recent" | null;
  readonly recentPercentPerSecond: number | null;
  readonly remainingPercent: number | null;
  readonly stalledMs: number | null;
}
