import type { HealthResponse } from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export type ApiHealthResult = ApiResult<HealthResponse>;

export interface ApiHealthQueryOptions {
  readonly refetchIntervalMs?: number;
}
