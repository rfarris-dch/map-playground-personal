export type EndpointBudgetClass =
  | "interactive-query"
  | "feature-collection"
  | "administrative-aggregation"
  | "proximity-enrichment"
  | "tile-serving";

export interface LatencyBudget {
  p95Ms: number;
  p99Ms: number;
}

export const DEFAULT_ENDPOINT_BUDGETS: Record<EndpointBudgetClass, LatencyBudget> = {
  "interactive-query": { p95Ms: 250, p99Ms: 600 },
  "feature-collection": { p95Ms: 500, p99Ms: 900 },
  "administrative-aggregation": { p95Ms: 250, p99Ms: 500 },
  "proximity-enrichment": { p95Ms: 400, p99Ms: 800 },
  "tile-serving": { p95Ms: 150, p99Ms: 400 },
};

export function isLatencyWithinBudget(
  budget: LatencyBudget,
  observedP95Ms: number,
  observedP99Ms: number
): boolean {
  return observedP95Ms <= budget.p95Ms && observedP99Ms <= budget.p99Ms;
}
