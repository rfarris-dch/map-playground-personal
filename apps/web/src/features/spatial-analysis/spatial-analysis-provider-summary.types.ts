import type { SpatialAnalysisProviderSummary } from "@map-migration/http-contracts/spatial-analysis-summary-http";

export type SpatialAnalysisProviderSummaryItem = Omit<
  SpatialAnalysisProviderSummary,
  "providerId"
> & {
  readonly providerId?: SpatialAnalysisProviderSummary["providerId"];
};
