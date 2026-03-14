<script setup lang="ts">
  import type {
    FacilitiesTableResponse,
    FacilitySortBy,
    FacilityTableRow,
    SortDirection,
  } from "@map-migration/http-contracts/table-contracts";
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
  import { fetchFacilitiesTable } from "@/features/facilities/facilities-table.api";
  import { useInfiniteScroll } from "@/features/table/use-infinite-scroll";

  interface FacilitiesSummary {
    readonly label: string;
    readonly value: string;
  }

  const pageSize = 100;
  const scrollContainerRef = useTemplateRef<HTMLDivElement>("colocation-scroll-container");
  const loadSentinelRef = useTemplateRef<HTMLDivElement>("colocation-load-sentinel");
  const sorting = shallowRef<SortingState>([{ id: "facilityName", desc: false }]);

  const facilitySortByColumnId: Record<string, FacilitySortBy> = {
    facilityName: "facilityName",
    providerId: "providerId",
    stateAbbrev: "stateAbbrev",
    commissionedSemantic: "commissionedSemantic",
    commissionedPowerMw: "commissionedPowerMw",
    availablePowerMw: "availablePowerMw",
  };

  const sortRequest = computed<{
    readonly sortBy: FacilitySortBy;
    readonly sortOrder: SortDirection;
  }>(() => {
    const currentSort = sorting.value[0];
    const fallback: { readonly sortBy: FacilitySortBy; readonly sortOrder: SortDirection } = {
      sortBy: "facilityName",
      sortOrder: "asc",
    };
    if (!currentSort) {
      return fallback;
    }

    const sortBy = facilitySortByColumnId[currentSort.id];
    if (!sortBy) {
      return fallback;
    }

    return {
      sortBy,
      sortOrder: currentSort.desc ? "desc" : "asc",
    };
  });

  const facilitiesQuery = useInfiniteQuery({
    queryKey: computed(() => [
      "facilities-table",
      "colocation",
      pageSize,
      sortRequest.value.sortBy,
      sortRequest.value.sortOrder,
    ]),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      fetchFacilitiesTable({
        perspective: "colocation",
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
    const pages = facilitiesQuery.data.value?.pages ?? [];
    return pages.filter((result) => result.ok).map((result) => result.data);
  });

  const flattenedRows = computed(() => successfulPages.value.flatMap((page) => page.rows));

  const firstPage = computed<FacilitiesTableResponse | null>(() => {
    const page = successfulPages.value[0];
    if (typeof page === "undefined") {
      return null;
    }

    return page;
  });

  const totalCount = computed(() => firstPage.value?.pagination.totalCount ?? 0);
  const loadedPages = computed(() => successfulPages.value.length);

  const loadErrorMessage = computed(() => {
    const pages = facilitiesQuery.data.value?.pages ?? [];
    for (const result of pages) {
      if (!result.ok) {
        return result.message ?? `Request failed (${result.reason})`;
      }
    }

    return null;
  });

  const summaries = computed<readonly FacilitiesSummary[]>(() => [
    {
      label: "Total Facilities",
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

  const hasNextPage = computed(() => facilitiesQuery.hasNextPage.value === true);
  const isLoadingMore = computed(() => facilitiesQuery.isFetchingNextPage.value);
  const loadMoreButtonLabel = computed(() => {
    if (isLoadingMore.value) {
      return "Loading...";
    }

    if (hasNextPage.value) {
      return "Load More";
    }

    return "All Rows Loaded";
  });

  const facilityColumnHelper = createColumnHelper<FacilityTableRow>();

  function getFacilityRowId(row: FacilityTableRow): string {
    return row.facilityId;
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

  const facilityColumns = [
    facilityColumnHelper.accessor("facilityName", {
      header: "Facility",
      cell: (context) => context.getValue(),
    }),
    facilityColumnHelper.accessor("providerId", {
      header: "Provider",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    facilityColumnHelper.accessor("stateAbbrev", {
      header: "State",
      cell: (context) => formatNullableText(context.getValue()),
    }),
    facilityColumnHelper.accessor("commissionedSemantic", {
      header: "Commissioned Status",
      cell: (context) => context.getValue(),
    }),
    facilityColumnHelper.accessor("commissionedPowerMw", {
      header: "Commissioned MW",
      aggregationFn: "sum",
      aggregatedCell: (context) => formatAggregatedNumber(context.getValue()),
      cell: (context) => formatNullableNumber(context.getValue()),
    }),
    facilityColumnHelper.accessor("availablePowerMw", {
      header: "Available MW",
      aggregationFn: "sum",
      aggregatedCell: (context) => formatAggregatedNumber(context.getValue()),
      cell: (context) => formatNullableNumber(context.getValue()),
    }),
  ];

  async function loadMoreRows(): Promise<void> {
    if (!hasNextPage.value || isLoadingMore.value) {
      return;
    }

    await facilitiesQuery.fetchNextPage();
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
  <div class="grid h-full min-h-0 gap-3">
    <div class="grid gap-3 md:grid-cols-3">
      <Card v-for="summary in summaries" :key="summary.label">
        <CardHeader>
          <CardDescription>{{ summary.label }}</CardDescription>
          <CardTitle class="text-2xl">{{ summary.value }}</CardTitle>
        </CardHeader>
      </Card>
    </div>

    <Card class="flex min-h-0 flex-1 flex-col">
      <CardHeader>
        <div class="space-y-1">
          <Badge variant="secondary">Colocation</Badge>
          <CardTitle>Colocation Facilities</CardTitle>
          <CardDescription>Infinite scroll over `serve.facility_site`.</CardDescription>
        </div>
      </CardHeader>
      <CardContent class="flex min-h-0 flex-1 flex-col gap-3">
        <div
          v-if="facilitiesQuery.isFetching.value && flattenedRows.length === 0"
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
          <p class="text-xs text-muted-foreground">Loading colocation facilities...</p>
        </div>
        <p v-if="loadErrorMessage" class="text-xs text-[var(--error)]">{{ loadErrorMessage }}</p>
        <div ref="colocation-scroll-container" class="min-h-0 flex-1 overflow-y-auto">
          <DataTable
            :columns="facilityColumns"
            :rows="flattenedRows"
            :facetable-column-ids="['providerId', 'stateAbbrev', 'commissionedSemantic']"
            :get-row-id="getFacilityRowId"
            :groupable-column-ids="['providerId', 'stateAbbrev', 'commissionedSemantic']"
            v-model:sorting="sorting"
            empty-state-label="No colocation facilities were returned."
            global-filter-placeholder="Search colocation facilities..."
            manual-sorting
            table-id="facilities-colocation"
          />
          <div ref="colocation-load-sentinel" class="h-6 w-full" aria-hidden="true"></div>
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
  </div>
</template>
