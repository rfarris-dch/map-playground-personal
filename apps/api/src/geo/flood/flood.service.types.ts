import type { SpatialAnalysisFloodSummary } from "@map-migration/http-contracts";

export interface QueryFloodAnalysisArgs {
  readonly geometryGeoJson: string;
}

export type QueryFloodAnalysisResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly dataVersion: string;
        readonly runId: string;
        readonly summary: SpatialAnalysisFloodSummary;
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed" | "source_unavailable";
      };
    };
