<script setup lang="ts">
  import type {
    MarketSortBy,
    MarketsTableResponse,
    MarketTableRow,
    SortDirection,
  } from "@map-migration/contracts";
  import { useInfiniteQuery } from "@tanstack/vue-query";
  import { createColumnHelper, type SortingState } from "@tanstack/vue-table";
  import { computed, shallowRef, useTemplateRef } from "vue";
  import Badge from "@/components/ui/badge/badge.vue";
  import Button from "@/components/ui/button/button.vue";
  import Card from "@/components/ui/card/card.vue";
  import CardContent from "@/components/ui/card/card-content.vue";
  import CardDescription from "@/components/ui/card/card-description.vue";
  import CardFooter from "@/components/ui/card/card-footer.vue";
  import CardHeader from "@/components/ui/card/card-header.vue";
  import CardTitle from "@/components/ui/card/card-title.vue";
  import DataTable from "@/components/ui/table/data-table.vue";
  import { fetchMarketsTable } from "@/features/markets/markets.api";
  import { useInfiniteScroll } from "@/features/table/use-infinite-scroll";

  interface MarketSummary {
    readonly label: string;
    readonly value: string;
  }

  const pageSize = 100;
  const scrollContainerRef = useTemplateRef<HTMLDivElement>("market-scroll-container");
  const loadSentinelRef = useTemplateRef<HTMLDivElement>("market-load-sentinel");
  const sorting = shallowRef<SortingState>([{ id: "name", desc: false }]);

  const marketSortByColumnId: Record<string, MarketSortBy> = {
    name: "name",
    region: "region",
    country: "country",
    state: "state",
    absorption: "absorption",
    vacancy: "vacancy",
  };

  const sortRequest = computed<{
    readonly sortBy: MarketSortBy;
    readonly sortOrder: SortDirection;
  }>(() => {
    const currentSort = sorting.value[0];
    const fallback: { readonly sortBy: MarketSortBy; readonly sortOrder: SortDirection } = {
      sortBy: "name",
      sortOrder: "asc",
    };
    if (!currentSort) {
      return fallback;
    }

    const sortBy = marketSortByColumnId[currentSort.id];
    if (!sortBy) {
      return fallback;
    }

    return {
      sortBy,
      sortOrder: currentSort.desc ? "desc" : "asc",
    };
  });

  const marketsQuery = useInfiniteQuery({
    queryKey: computed(() => [
      "markets-table",
      pageSize,
      sortRequest.value.sortBy,
      sortRequest.value.sortOrder,
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchMarketsTable({
        page: pageParam,
        pageSize,
        sortBy: sortRequest.value.sortBy,
        sortOrder: sortRequest.value.sortOrder,
        signal,
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
    const pages = marketsQuery.data.value?.pages ?? [];
    return pages.filter((result) => result.ok).map((result) => result.data);
  });

  const flattenedRows = computed(() => successfulPages.value.flatMap((page) => page.rows));

  const firstPage = computed<MarketsTableResponse | null>(() => {
    const page = successfulPages.value[0];
    if (typeof page === "undefined") {
      return null;
    }

    return page;
  });

  const totalCount = computed(() => firstPage.value?.pagination.totalCount ?? 0);
  const loadedPages = computed(() => successfulPages.value.length);

  const loadErrorMessage = computed(() => {
    const pages = marketsQuery.data.value?.pages ?? [];
    for (const result of pages) {
      if (!result.ok) {
        return result.message ?? `Request failed (${result.reason})`;
      }
    }

    return null;
  });

  const marketSummaries = computed<readonly MarketSummary[]>(() => [
    {
      label: "Total Markets",
      value: totalCount.value.toLocaleString(),
    },
    {
      label: "Loaded Rows",
      value: flattenedRows.value.length.toLocaleString(),
    },
    {
      label: "Loaded Pages",
      value: loadedPages.value.toLocaleString(),
    },
  ]);

  const hasNextPage = computed(() => marketsQuery.hasNextPage.value === true);
  const isLoadingMore = computed(() => marketsQuery.isFetchingNextPage.value);
  const loadMoreButtonLabel = computed(() => {
    if (isLoadingMore.value) {
      return "Loading...";
    }

    if (hasNextPage.value) {
      return "Load More";
    }

    return "All Rows Loaded";
  });

  const marketColumnHelper = createColumnHelper<MarketTableRow>();

  function getMarketRowId(row: MarketTableRow): string {
    return row.marketId;
  }

  function formatNullableText(value: string | null): string {
    return value ?? "—";
  }

  function formatNullableNumber(value: number | null): string {
    if (value === null) {
      return "—";
    }

    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatAggregatedNumber(value: unknown): string {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  const marketColumns = [
    marketColumnHelper.accessor("name", {
      header: "Market",
      cell: (context) => context.getValue(),
    }),
    marketColumnHelper.accessor("region", {
      header: "Region",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    marketColumnHelper.accessor("country", {
      header: "Country",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    marketColumnHelper.accessor("state", {
      header: "State",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    marketColumnHelper.accessor("absorption", {
      header: "Absorption",
      aggregationFn: "mean",
      aggregatedCell: (context) => formatAggregatedNumber(context.getValue()),
      cell: (context) => formatNullableNumber(context.getValue()),
    }),
    marketColumnHelper.accessor("vacancy", {
      header: "Vacancy",
      aggregationFn: "mean",
      aggregatedCell: (context) => formatAggregatedNumber(context.getValue()),
      cell: (context) => formatNullableNumber(context.getValue()),
    }),
  ];

  async function loadMoreRows(): Promise<void> {
    if (!hasNextPage.value || isLoadingMore.value) {
      return;
    }

    await marketsQuery.fetchNextPage();
  }

  useInfiniteScroll({
    containerRef: scrollContainerRef,
    sentinelRef: loadSentinelRef,
    canLoadMore: hasNextPage,
    isLoadingMore,
    loadMore: loadMoreRows,
  });
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-4 px-4 py-4">
    <header class="space-y-2">
      <Badge>Markets</Badge>
      <h1 class="text-xl font-semibold tracking-tight">Markets</h1>
      <p class="text-sm text-muted-foreground">
        Live table from Postgres (`market_current.markets`, `search_page = true`).
      </p>
    </header>

    <div class="grid gap-3 md:grid-cols-3">
      <Card v-for="summary in marketSummaries" :key="summary.label">
        <CardHeader>
          <CardDescription>{{ summary.label }}</CardDescription>
          <CardTitle class="text-2xl">{{ summary.value }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card class="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle>Market Table</CardTitle>
        <CardDescription>Infinite scroll over paginated API responses.</CardDescription>
      </CardHeader>
      <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
        <div
          v-if="marketsQuery.isFetching.value && flattenedRows.length === 0"
          class="space-y-3 py-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div class="h-8 w-full animate-pulse rounded bg-muted/60" />
          <div class="h-6 w-3/4 animate-pulse rounded bg-muted/40" />
          <div class="h-6 w-5/6 animate-pulse rounded bg-muted/40" />
          <div class="h-6 w-2/3 animate-pulse rounded bg-muted/40" />
          <div class="h-6 w-4/5 animate-pulse rounded bg-muted/40" />
          <p class="text-xs text-muted-foreground">Loading market data...</p>
        </div>
        <p v-if="loadErrorMessage" class="text-xs text-[var(--error)]">{{ loadErrorMessage }}</p>
        <div ref="market-scroll-container" class="min-h-0 flex-1 overflow-y-auto">
          <DataTable
            :columns="marketColumns"
            :rows="flattenedRows"
            :facetable-column-ids="['region', 'country', 'state']"
            :groupable-column-ids="['region', 'country', 'state']"
            :get-row-id="getMarketRowId"
            v-model:sorting="sorting"
            empty-state-label="No market rows were returned."
            global-filter-placeholder="Search markets..."
            manual-sorting
            table-id="markets"
          />
          <div ref="market-load-sentinel" class="h-6 w-full" aria-hidden="true"></div>
        </div>
      </CardContent>
      <CardFooter class="justify-between">
        <span class="text-xs text-muted-foreground">
          Loaded {{ flattenedRows.length.toLocaleString() }} of {{ totalCount.toLocaleString() }}
        </span>
        <Button size="sm" :disabled="!hasNextPage || isLoadingMore" @click="loadMoreRows">
          {{ loadMoreButtonLabel }}
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>
