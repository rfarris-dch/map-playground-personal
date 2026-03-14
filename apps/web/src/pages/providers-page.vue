<script setup lang="ts">
  import type {
    ProviderSortBy,
    ProviderTableRow,
  } from "@map-migration/http-contracts/table-contracts";
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
  import { fetchProvidersTable } from "@/features/providers/providers.api";

  interface ProviderSummary {
    readonly label: string;
    readonly value: string;
  }

  const providerSortByColumnId: Record<string, ProviderSortBy> = {
    name: "name",
    category: "category",
    country: "country",
    state: "state",
    listingCount: "listingCount",
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
  } = useInfiniteTablePage<ProviderSortBy, ProviderTableRow>({
    queryKey: computed(() => ["providers-table"]),
    fetchPage: (request) =>
      fetchProvidersTable({
        page: request.page,
        pageSize: request.pageSize,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder,
        signal: request.signal,
      }),
    defaultSortId: "name",
    sortByColumnId: providerSortByColumnId,
    scrollContainerRefName: "provider-scroll-container",
    loadSentinelRefName: "provider-load-sentinel",
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
      row.supportsColocation ? "Colocation" : null,
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
