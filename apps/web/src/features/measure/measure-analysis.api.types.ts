import type { ApiResult } from "@map-migration/core-runtime/api";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";

export type ParcelsSelectionResult = ApiResult<ParcelsFeatureCollection>;

export interface FetchParcelsBySelectionOptions {
  readonly expectedIngestionRunId?: string | null;
}
