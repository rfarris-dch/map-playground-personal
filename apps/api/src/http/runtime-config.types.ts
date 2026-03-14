import type { SourceMode } from "@map-migration/http-contracts/api-response-meta";

export interface ApiRuntimeConfig {
  readonly boundariesSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}
