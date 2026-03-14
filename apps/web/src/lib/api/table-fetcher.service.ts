import type { SortDirection } from "@map-migration/http-contracts/table-contracts";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";
import { createTypedGetFetcher, type SafeParseSchema } from "@/lib/api/typed-get-fetcher.service";

export type PagedSortedRequest<TSort, TExtra = object> = TExtra & {
  readonly page: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly sortBy: TSort;
  readonly sortOrder: SortDirection;
};

export function createTableFetcher<TSort, TExtra, TValue>(
  buildRoute: (request: PagedSortedRequest<TSort, TExtra>) => string,
  schema: SafeParseSchema<TValue>
) {
  return createTypedGetFetcher<PagedSortedRequest<TSort, TExtra>, TValue>({
    buildRequestInit(request) {
      return buildApiRequestInit({
        signal: request.signal,
      });
    },
    buildRoute,
    schema,
  });
}
