import { type ApiResult, apiRequestJson } from "@map-migration/core-runtime/api";
import type { SafeParseSchema } from "@map-migration/core-runtime/effect";

export type { SafeParseSchema } from "@map-migration/core-runtime/effect";

interface CreateTypedGetFetcherOptions<TRequest, TValue> {
  readonly buildRequestInit?: ((request: TRequest) => RequestInit) | undefined;
  readonly buildRoute: (request: TRequest) => string;
  readonly schema: SafeParseSchema<TValue>;
}

export function createTypedGetFetcher<TRequest, TValue>(
  options: CreateTypedGetFetcherOptions<TRequest, TValue>
) {
  return (request: TRequest): Promise<ApiResult<TValue>> => {
    const requestInit =
      typeof options.buildRequestInit === "function" ? options.buildRequestInit(request) : {};

    return apiRequestJson(options.buildRoute(request), options.schema, requestInit);
  };
}
