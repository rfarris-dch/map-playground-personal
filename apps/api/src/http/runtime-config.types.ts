import type { SourceMode } from "@map-migration/http-contracts/api-response-meta";

export interface ApiRuntimeConfig {
  readonly analysisSummarySourceMode: SourceMode;
  readonly boundariesSourceMode: SourceMode;
  readonly countyIntelligenceSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesDatasetPreviousVersion: string | null;
  readonly facilitiesDatasetPublishedAt: string;
  readonly facilitiesDatasetVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly facilitiesWarmProfileVersion: string | null;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly marketBoundariesSourceMode: SourceMode;
  readonly marketsSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}
