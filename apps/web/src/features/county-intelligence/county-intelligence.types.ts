import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  CountyScoresCoverageResponse,
  CountyScoresDebugResponse,
  CountyScoresResolutionResponse,
  CountyScoresResponse,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";

export type CountyScoresFetchResult = ApiResult<CountyScoresResponse>;

export type CountyScoresStatusFetchResult = ApiResult<CountyScoresStatusResponse>;

export type CountyScoresCoverageFetchResult = ApiResult<CountyScoresCoverageResponse>;

export type CountyScoresResolutionFetchResult = ApiResult<CountyScoresResolutionResponse>;

export type CountyScoresDebugFetchResult = ApiResult<CountyScoresDebugResponse>;
