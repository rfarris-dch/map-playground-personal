import type {
  ProviderSortBy,
  ProviderTableRow,
  SortDirection,
} from "@map-migration/http-contracts/table-contracts";
import type { ProviderListRow } from "@/geo/providers/providers.repo";

export type QueryProviderRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly ProviderListRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

export type QueryProvidersTableResult =
  | { readonly ok: true; readonly value: QueryProvidersTableSuccess }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryProvidersTableSuccess {
  readonly rows: readonly ProviderTableRow[];
  readonly totalCount: number;
}

export interface QueryProvidersTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

export interface ProvidersRepoPort {
  readonly listProvidersPage: (args: {
    readonly limit: number;
    readonly offset: number;
    readonly sortBy: ProviderSortBy;
    readonly sortOrder: SortDirection;
  }) => Promise<readonly ProviderListRow[]>;
}
