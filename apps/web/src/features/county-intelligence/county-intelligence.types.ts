import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";

export type CountyScoresFetchResult = ApiResult<CountyScoresResponse>;

export type CountyScoresStatusFetchResult = ApiResult<CountyScoresStatusResponse>;
