export interface LatencyBudget {
  p95Ms: number;
  p99Ms: number;
}

export type EndpointBudgetClass =
  | "interactive-query"
  | "feature-collection"
  | "administrative-aggregation"
  | "proximity-enrichment"
  | "tile-serving";
