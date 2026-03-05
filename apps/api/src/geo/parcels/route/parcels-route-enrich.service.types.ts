import type { ParcelsFeatureCollection, Warning } from "@map-migration/contracts";

export interface PaginatedEnrichFeatures {
  readonly features: ParcelsFeatureCollection["features"];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface PageSizeResolution {
  readonly pageSize: number;
  readonly warnings: Warning[];
}
