<script setup lang="ts">
  import type { MarketSortBy, MarketTableRow } from "@map-migration/http-contracts/table-contracts";
  import { createColumnHelper } from "@tanstack/vue-table";
  import { computed } from "vue";
  import Badge from "@/components/ui/badge/badge.vue";
  import Button from "@/components/ui/button/button.vue";
  import Card from "@/components/ui/card/card.vue";
  import CardContent from "@/components/ui/card/card-content.vue";
  import CardDescription from "@/components/ui/card/card-description.vue";
  import CardFooter from "@/components/ui/card/card-footer.vue";
  import CardHeader from "@/components/ui/card/card-header.vue";
  import CardTitle from "@/components/ui/card/card-title.vue";
  import DataTable from "@/components/ui/table/data-table.vue";
  import { useInfiniteTablePage } from "@/composables/use-infinite-table-page";
  import { fetchMarketsTable } from "@/features/markets/markets.api";

  interface MarketSummary {
    readonly label: string;
    readonly value: string;
  }

  const marketSortByColumnId: Record<string, MarketSortBy> = {
    name: "name",
    region: "region",
    country: "country",
    state: "state",
    absorption: "absorption",
    vacancy: "vacancy",
  };

  const {
    sorting,
    flattenedRows,
    totalCount,
    loadedPages,
    hasNextPage,
    isFetching,
    isLoadingMore,
    loadMoreButtonLabel,
    loadErrorMessage,
    loadMoreRows,
  } = useInfiniteTablePage<MarketSortBy, MarketTableRow>({
    queryKey: computed(() => ["markets-table"]),
    fetchPage: (request) =>
      fetchMarketsTable({
        page: request.page,
        pageSize: request.pageSize,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder,
        signal: request.signal,
      }),
    defaultSortId: "name",
    sortByColumnId: marketSortByColumnId,
    scrollContainerRefName: "market-scroll-container",
    loadSentinelRefName: "market-load-sentinel",
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
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col gap-4 px-4 py-4">
    <header class="space-y-2">
      <Badge>Markets</Badge>
      <h1 class="text-xl font-semibold tracking-tight">Markets</h1>
      <p class="text-sm text-muted-foreground">
        Browse all data center markets with absorption and vacancy data.
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
        <CardDescription>All markets with sortable columns and filtering.</CardDescription>
      </CardHeader>
      <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
        <div
          v-if="isFetching && flattenedRows.length === 0"
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
