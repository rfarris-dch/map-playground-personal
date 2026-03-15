import type { SourceMode } from "@map-migration/http-contracts/api-response-meta";

export interface ApiRuntimeConfig {
  readonly analysisSummarySourceMode: SourceMode;
  readonly boundariesSourceMode: SourceMode;
  readonly countyIntelligenceSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly marketBoundariesSourceMode: SourceMode;
  readonly marketsSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}
