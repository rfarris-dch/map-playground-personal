import type { ApiResult } from "@map-migration/core-runtime/api";
import { useInfiniteQuery } from "@tanstack/vue-query";
import type { SortingState } from "@tanstack/vue-table";
import { type ComputedRef, computed, type Ref, shallowRef, useTemplateRef } from "vue";
import { useInfiniteScroll } from "@/features/table/use-infinite-scroll";

/**
 * Shared shape that all table response types conform to.
 * Each response must have `rows` and a `pagination` block.
 */
interface TablePageResponse<TRow> {
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalCount: number;
    readonly totalPages: number;
  };
  readonly rows: readonly TRow[];
}

export interface UseInfiniteTablePageOptions<TSort extends string, TRow, TExtra = object> {
  /** Default sort direction. Defaults to `false` (ascending). */
  readonly defaultSortDesc?: boolean;
  /** Default column id used for sorting when no explicit sort is active. */
  readonly defaultSortId: TSort;
  /** Optional extra params merged into every fetch request. */
  readonly extraParams?: TExtra;
  /**
   * Fetches a single page. Receives the current page number, resolved sort
   * params, and an abort signal.
   */
  readonly fetchPage: (
    request: TExtra & {
      readonly page: number;
      readonly pageSize: number;
      readonly signal: AbortSignal;
      readonly sortBy: TSort;
      readonly sortOrder: "asc" | "desc";
    }
  ) => Promise<ApiResult<TablePageResponse<TRow>>>;
  /** Template ref name for the load sentinel element. */
  readonly loadSentinelRefName: string;
  /** Number of rows per page. Defaults to 100. */
  readonly pageSize?: number;
  /**
   * Vue query key. Should include any reactive values that, when changed,
   * should cause the query to refetch from the first page.
   */
  readonly queryKey: ComputedRef<unknown[]>;
  /** Template ref name for the scroll container element. */
  readonly scrollContainerRefName: string;
  /**
   * Map from column id to the sort-by value accepted by the API.
   * Only columns listed here are sortable server-side.
   */
  readonly sortByColumnId: Record<string, TSort>;
}

export interface UseInfiniteTablePageReturn<TRow> {
  readonly flattenedRows: ComputedRef<TRow[]>;
  readonly hasNextPage: ComputedRef<boolean>;
  readonly isFetching: ComputedRef<boolean>;
  readonly isLoadingMore: ComputedRef<boolean>;
  readonly loadErrorMessage: ComputedRef<string | null>;
  readonly loadedPages: ComputedRef<number>;
  readonly loadMoreButtonLabel: ComputedRef<string>;
  readonly loadMoreRows: () => Promise<void>;
  readonly loadSentinelRef: Ref<HTMLDivElement | null>;
  readonly scrollContainerRef: Ref<HTMLDivElement | null>;
  readonly sorting: Ref<SortingState>;
  readonly totalCount: ComputedRef<number>;
}

export function useInfiniteTablePage<TSort extends string, TRow, TExtra = object>(
  options: UseInfiniteTablePageOptions<TSort, TRow, TExtra>
): UseInfiniteTablePageReturn<TRow> {
  const pageSize = options.pageSize ?? 100;

  const scrollContainerRef = useTemplateRef<HTMLDivElement>(options.scrollContainerRefName);
  const loadSentinelRef = useTemplateRef<HTMLDivElement>(options.loadSentinelRefName);

  const sorting = shallowRef<SortingState>([
    { id: options.defaultSortId, desc: options.defaultSortDesc ?? false },
  ]);

  const sortRequest = computed<{ readonly sortBy: TSort; readonly sortOrder: "asc" | "desc" }>(
    () => {
      const currentSort = sorting.value[0];
      const fallback = {
        sortBy: options.defaultSortId,
        sortOrder: (options.defaultSortDesc ? "desc" : "asc") as "asc" | "desc",
      };

      if (!currentSort) {
        return fallback;
      }

      const sortBy = options.sortByColumnId[currentSort.id];
      if (!sortBy) {
        return fallback;
      }

      return {
        sortBy,
        sortOrder: (currentSort.desc ? "desc" : "asc") as "asc" | "desc",
      };
    }
  );

  const query = useInfiniteQuery({
    queryKey: computed(() => [
      ...options.queryKey.value,
      pageSize,
      sortRequest.value.sortBy,
      sortRequest.value.sortOrder,
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      options.fetchPage({
        ...(options.extraParams as TExtra & object),
        page: pageParam,
        pageSize,
        sortBy: sortRequest.value.sortBy,
        sortOrder: sortRequest.value.sortOrder,
        signal,
      } as TExtra & {
        page: number;
        pageSize: number;
        signal: AbortSignal;
        sortBy: TSort;
        sortOrder: "asc" | "desc";
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.ok) {
        return undefined;
      }

      const nextPage = lastPage.data.pagination.page + 1;
      if (nextPage >= lastPage.data.pagination.totalPages) {
        return undefined;
      }

      return nextPage;
    },
  });

  const successfulPages = computed(() => {
    const pages = query.data.value?.pages ?? [];
    return pages.filter((result) => result.ok).map((result) => result.data);
  });

  const flattenedRows = computed(() =>
    successfulPages.value.flatMap((page) => page.rows as TRow[])
  );

  const firstPage = computed(() => {
    const page = successfulPages.value[0];
    if (typeof page === "undefined") {
      return null;
    }
    return page;
  });

  const totalCount = computed(() => firstPage.value?.pagination.totalCount ?? 0);
  const loadedPages = computed(() => successfulPages.value.length);

  const loadErrorMessage = computed(() => {
    const pages = query.data.value?.pages ?? [];
    for (const result of pages) {
      if (!result.ok) {
        return result.message ?? `Request failed (${result.reason})`;
      }
    }
    return null;
  });

  const hasNextPage = computed(() => query.hasNextPage.value === true);
  const isFetching = computed(() => query.isFetching.value);
  const isLoadingMore = computed(() => query.isFetchingNextPage.value);

  const loadMoreButtonLabel = computed(() => {
    if (isLoadingMore.value) {
      return "Loading...";
    }
    if (hasNextPage.value) {
      return "Load More";
    }
    return "All Rows Loaded";
  });

  async function loadMoreRows(): Promise<void> {
    if (!hasNextPage.value || isLoadingMore.value) {
      return;
    }
    await query.fetchNextPage();
  }

  useInfiniteScroll({
    containerRef: scrollContainerRef,
    sentinelRef: loadSentinelRef,
    canLoadMore: hasNextPage,
    isLoadingMore,
    loadMore: loadMoreRows,
  });

  return {
    flattenedRows,
    hasNextPage,
    isFetching,
    isLoadingMore,
    loadErrorMessage,
    loadMoreButtonLabel,
    loadMoreRows,
    loadSentinelRef,
    loadedPages,
    scrollContainerRef,
    sorting,
    totalCount,
  };
}
