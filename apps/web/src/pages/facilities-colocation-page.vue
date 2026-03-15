<script setup lang="ts">
  import type {
    FacilitySortBy,
    FacilityTableRow,
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
  import { fetchFacilitiesTable } from "@/features/facilities/facilities-table.api";

  interface FacilitiesSummary {
    readonly label: string;
    readonly value: string;
  }

  const facilitySortByColumnId: Record<string, FacilitySortBy> = {
    facilityName: "facilityName",
    providerId: "providerId",
    stateAbbrev: "stateAbbrev",
    commissionedSemantic: "commissionedSemantic",
    commissionedPowerMw: "commissionedPowerMw",
    availablePowerMw: "availablePowerMw",
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
  } = useInfiniteTablePage<
    FacilitySortBy,
    FacilityTableRow,
    { readonly perspective: "colocation" }
  >({
    queryKey: computed(() => ["facilities-table", "colocation"]),
    fetchPage: (request) =>
      fetchFacilitiesTable({
        perspective: request.perspective,
        page: request.page,
        pageSize: request.pageSize,
        sortBy: request.sortBy,
        sortOrder: request.sortOrder,
        signal: request.signal,
      }),
    defaultSortId: "facilityName",
    sortByColumnId: facilitySortByColumnId,
    scrollContainerRefName: "colocation-scroll-container",
    loadSentinelRefName: "colocation-load-sentinel",
    extraParams: { perspective: "colocation" as const },
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
          <CardDescription
            >All colocation facilities with sortable columns and filtering.</CardDescription
          >
        </div>
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
