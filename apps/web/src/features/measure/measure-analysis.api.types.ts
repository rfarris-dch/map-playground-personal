import type { ApiResult } from "@map-migration/core-runtime/api";
import type { FacilitiesSelectionResponse } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";

export type ParcelsSelectionResult = ApiResult<ParcelsFeatureCollection>;

export type FacilitiesSelectionResult = ApiResult<FacilitiesSelectionResponse>;

export interface FetchParcelsBySelectionOptions {
  readonly expectedIngestionRunId?: string | null;
}
