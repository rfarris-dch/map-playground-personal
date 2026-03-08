import type {
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/contracts";

export interface QuerySpatialAnalysisSummaryArgs {
  readonly expectedParcelIngestionRunId: string | null;
  readonly request: SpatialAnalysisSummaryRequest;
}

export type QuerySpatialAnalysisSummaryResult =
  | {
      readonly ok: true;
      readonly value: Omit<SpatialAnalysisSummaryResponse, "meta">;
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason:
          | "facilities_mapping_failed"
          | "facilities_policy_rejected"
          | "facilities_query_failed"
          | "parcel_ingestion_run_mismatch"
          | "parcels_mapping_failed"
          | "parcels_policy_rejected"
          | "parcels_query_failed";
      };
    };
