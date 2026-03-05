export type ResolvePaginationResult =
  | {
      readonly ok: true;
      readonly value: PaginationParams;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export interface ResolvePaginationOptions {
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
}

export interface PaginationParams {
  readonly offset: number;
  readonly page: number;
  readonly pageSize: number;
}
