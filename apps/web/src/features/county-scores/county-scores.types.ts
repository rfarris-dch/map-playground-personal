import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";

export type CountyScoresFetchResult = ApiResult<CountyScoresResponse>;

export type CountyScoresStatusFetchResult = ApiResult<CountyScoresStatusResponse>;
