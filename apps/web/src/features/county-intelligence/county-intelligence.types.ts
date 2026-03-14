import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/http-contracts/county-intelligence-http";
import type { ApiResult } from "@map-migration/core-runtime/api";

export type CountyScoresFetchResult = ApiResult<CountyScoresResponse>;

export type CountyScoresStatusFetchResult = ApiResult<CountyScoresStatusResponse>;
