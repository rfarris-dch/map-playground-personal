<script setup lang="ts">
  import type {
    ProviderSortBy,
    ProvidersTableResponse,
    ProviderTableRow,
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
  import { fetchProvidersTable } from "@/features/providers/providers.api";
  import { useInfiniteScroll } from "@/features/table/use-infinite-scroll";

  interface ProviderSummary {
    readonly label: string;
    readonly value: string;
  }

  const pageSize = 100;
  const scrollContainerRef = useTemplateRef<HTMLDivElement>("provider-scroll-container");
  const loadSentinelRef = useTemplateRef<HTMLDivElement>("provider-load-sentinel");
  const sorting = shallowRef<SortingState>([{ id: "name", desc: false }]);

  const providerSortByColumnId: Record<string, ProviderSortBy> = {
    name: "name",
    category: "category",
    country: "country",
    state: "state",
    listingCount: "listingCount",
  };

  const sortRequest = computed<{
    readonly sortBy: ProviderSortBy;
    readonly sortOrder: SortDirection;
  }>(() => {
    const currentSort = sorting.value[0];
    const fallback: { readonly sortBy: ProviderSortBy; readonly sortOrder: SortDirection } = {
      sortBy: "name",
      sortOrder: "asc",
    };
    if (!currentSort) {
      return fallback;
    }

    const sortBy = providerSortByColumnId[currentSort.id];
    if (!sortBy) {
      return fallback;
    }

    return {
      sortBy,
      sortOrder: currentSort.desc ? "desc" : "asc",
    };
  });

  const providersQuery = useInfiniteQuery({
    queryKey: computed(() => [
      "providers-table",
      pageSize,
      sortRequest.value.sortBy,
      sortRequest.value.sortOrder,
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchProvidersTable({
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
    const pages = providersQuery.data.value?.pages ?? [];
    return pages.filter((result) => result.ok).map((result) => result.data);
  });

  const flattenedRows = computed(() => successfulPages.value.flatMap((page) => page.rows));

  const firstPage = computed<ProvidersTableResponse | null>(() => {
    const page = successfulPages.value[0];
    if (typeof page === "undefined") {
      return null;
    }

    return page;
  });

  const totalCount = computed(() => firstPage.value?.pagination.totalCount ?? 0);
  const loadedPages = computed(() => successfulPages.value.length);

  const loadErrorMessage = computed(() => {
    const pages = providersQuery.data.value?.pages ?? [];
    for (const result of pages) {
      if (!result.ok) {
        return result.message ?? `Request failed (${result.reason})`;
      }
    }

    return null;
  });

  const providerSummaries = computed<readonly ProviderSummary[]>(() => [
    {
      label: "Total Providers",
      value: totalCount.value.toLocaleString(),
    },
    {
      label: "Loaded Rows",
      value: flattenedRows.value.length.toLocaleString(),
    },
    {
      label: "Loaded Pages",
      value: String(loadedPages.value),
    },
  ]);

  const hasNextPage = computed(() => providersQuery.hasNextPage.value === true);
  const isLoadingMore = computed(() => providersQuery.isFetchingNextPage.value);
  const loadMoreButtonLabel = computed(() => {
    if (isLoadingMore.value) {
      return "Loading...";
    }

    if (hasNextPage.value) {
      return "Load More";
    }

    return "All Rows Loaded";
  });

  const providerColumnHelper = createColumnHelper<ProviderTableRow>();

  function getProviderRowId(row: ProviderTableRow): string {
    return row.providerId;
  }

  function formatNullableText(value: string | null): string {
    return value ?? "—";
  }

  function formatNullableInteger(value: number | null): string {
    if (value === null) {
      return "—";
    }

    return value.toLocaleString();
  }

  function formatAggregatedInteger(value: unknown): string {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    return Math.round(value).toLocaleString();
  }

  function formatCapabilities(row: ProviderTableRow): string {
    const capabilities = [
      row.supportsHyperscale ? "Hyperscale" : null,
      row.supportsRetail ? "Retail" : null,
      row.supportsWholesale ? "Wholesale" : null,
    ].filter((value) => value !== null);

    if (capabilities.length === 0) {
      return "—";
    }

    return capabilities.join(", ");
  }

  const providerColumns = [
    providerColumnHelper.accessor("name", {
      header: "Provider",
      cell: (context) => context.getValue(),
    }),
    providerColumnHelper.accessor("category", {
      header: "Category",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    providerColumnHelper.accessor("country", {
      header: "Country",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    providerColumnHelper.accessor("state", {
      header: "State",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    providerColumnHelper.accessor("listingCount", {
      header: "Listings",
      aggregationFn: "sum",
      aggregatedCell: (context) => formatAggregatedInteger(context.getValue()),
      cell: (context) => formatNullableInteger(context.getValue()),
    }),
    providerColumnHelper.display({
      id: "capabilities",
      enableSorting: false,
      header: "Capabilities",
      cell: (context) => formatCapabilities(context.row.original),
    }),
  ];

  async function loadMoreRows(): Promise<void> {
    if (!hasNextPage.value || isLoadingMore.value) {
      return;
    }

    await providersQuery.fetchNextPage();
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
      <Badge>Providers</Badge>
      <h1 class="text-xl font-semibold tracking-tight">Providers</h1>
      <p class="text-sm text-muted-foreground">
        Live provider rollup from `serve.facility_site`, `serve.hyperscale_site`, and
        `facility_current.providers`.
      </p>
    </header>

    <div class="grid gap-3 md:grid-cols-3">
      <Card v-for="summary in providerSummaries" :key="summary.label">
        <CardHeader>
          <CardDescription>{{ summary.label }}</CardDescription>
          <CardTitle class="text-2xl">{{ summary.value }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card class="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <CardTitle>Provider Table</CardTitle>
        <CardDescription>Infinite scroll over paginated API responses.</CardDescription>
      </CardHeader>
      <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
        <div
          v-if="providersQuery.isFetching.value && flattenedRows.length === 0"
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
          <p class="text-xs text-muted-foreground">Loading provider data...</p>
        </div>
        <p v-if="loadErrorMessage" class="text-xs text-[var(--error)]">{{ loadErrorMessage }}</p>
        <div ref="provider-scroll-container" class="min-h-0 flex-1 overflow-y-auto">
          <DataTable
            :columns="providerColumns"
            :rows="flattenedRows"
            :facetable-column-ids="['category', 'country', 'state']"
            :groupable-column-ids="['category', 'country', 'state']"
            :get-row-id="getProviderRowId"
            v-model:sorting="sorting"
            empty-state-label="No provider rows were returned."
            global-filter-placeholder="Search providers..."
            manual-sorting
            table-id="providers"
          />
          <div ref="provider-load-sentinel" class="h-6 w-full" aria-hidden="true"></div>
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
