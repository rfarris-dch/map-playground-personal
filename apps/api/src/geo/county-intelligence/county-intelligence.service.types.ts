import type {
  CountyScore,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";

export interface QueryCountyScoresArgs {
  readonly countyIds: readonly string[];
  readonly statusSnapshot?:
    | import("@/geo/county-intelligence/county-intelligence.repo").CountyScoresStatusRow
    | undefined;
}

export type QueryCountyScoresResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly dataVersion: string;
        readonly blockedCountyIds: readonly string[];
        readonly deferredCountyIds: readonly string[];
        readonly rows: readonly CountyScore[];
        readonly missingCountyIds: readonly string[];
        readonly requestedCountyIds: readonly string[];
      };
    }
  | {
      readonly ok: false;
      readonly value:
        | {
            readonly reason: "source_unavailable";
            readonly error: unknown;
          }
        | {
            readonly reason: "query_failed";
            readonly error: unknown;
          }
        | {
            readonly reason: "mapping_failed";
            readonly error: unknown;
          };
    };

export type QueryCountyScoresStatusResult =
  | {
      readonly ok: true;
      readonly value: Omit<CountyScoresStatusResponse, "meta">;
    }
  | {
      readonly ok: false;
      readonly value:
        | {
            readonly reason: "source_unavailable";
            readonly error: unknown;
          }
        | {
            readonly reason: "query_failed";
            readonly error: unknown;
          }
        | {
            readonly reason: "mapping_failed";
            readonly error: unknown;
          };
    };
