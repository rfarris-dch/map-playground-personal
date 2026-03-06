import type {
  FacilitiesSelectionResponse,
  ParcelsFeatureCollection,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export type ParcelsSelectionResult = ApiResult<ParcelsFeatureCollection>;

export type FacilitiesSelectionResult = ApiResult<FacilitiesSelectionResponse>;

export interface FetchParcelsBySelectionOptions {
  readonly expectedIngestionRunId?: string | null;
}
