import type { SourceMode } from "@map-migration/http-contracts";

export interface ApiRuntimeConfig {
  readonly boundariesSourceMode: SourceMode;
  readonly dataVersion: string;
  readonly facilitiesSourceMode: SourceMode;
  readonly fiberLocatorSourceMode: SourceMode;
  readonly parcelsSourceMode: SourceMode;
}
