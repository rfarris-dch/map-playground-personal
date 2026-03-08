import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export type CountyScoresFetchResult = ApiResult<CountyScoresResponse>;

export type CountyScoresStatusFetchResult = ApiResult<CountyScoresStatusResponse>;
