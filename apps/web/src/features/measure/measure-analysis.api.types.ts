import type { FacilitiesSelectionResponse, ParcelsFeatureCollection } from "@map-migration/http-contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";

export type ParcelsSelectionResult = ApiResult<ParcelsFeatureCollection>;

export type FacilitiesSelectionResult = ApiResult<FacilitiesSelectionResponse>;

export interface FetchParcelsBySelectionOptions {
  readonly expectedIngestionRunId?: string | null;
}
