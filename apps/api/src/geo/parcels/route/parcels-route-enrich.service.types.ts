import type { Warning } from "@map-migration/geo-kernel";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts";

export interface PaginatedEnrichFeatures {
  readonly features: ParcelsFeatureCollection["features"];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface PageSizeResolution {
  readonly pageSize: number;
  readonly warnings: Warning[];
}
