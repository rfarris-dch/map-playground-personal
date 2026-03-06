<script setup lang="ts" generic="TData extends RowData">
  import {
    type ExpandedState,
    FlexRender,
    functionalUpdate,
    type GroupingState,
    getCoreRowModel,
    getExpandedRowModel,
    getGroupedRowModel,
    getSortedRowModel,
    type RowData,
    type RowSelectionState,
    type SortingState,
    type Updater,
    useVueTable,
    type VisibilityState,
  } from "@tanstack/vue-table";
  import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-vue-next";
  import { computed, shallowRef } from "vue";
  import Badge from "@/components/ui/badge/badge.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import Table from "@/components/ui/table/table.vue";
  import TableBody from "@/components/ui/table/table-body.vue";
  import TableCell from "@/components/ui/table/table-cell.vue";
  import TableHead from "@/components/ui/table/table-head.vue";
  import TableHeader from "@/components/ui/table/table-header.vue";
  import TableRow from "@/components/ui/table/table-row.vue";
  import {
    createFacetableColumns,
    readRowValue,
    rowMatchesGlobalQuery,
    toCheckboxBoolean,
    toFacetToken,
  } from "./data-table.service";
  import type {
    DataTableColumns,
    FacetableColumn,
    GroupableColumnOption,
    HideableColumnOption,
  } from "./data-table.types";
  import DataTableFacetMenu from "./data-table-facet-menu.vue";
  import DataTableToolbar from "./data-table-toolbar.vue";
  import { useDataTableFilters } from "./use-data-table-filters";
  import { useDataTableUrlState } from "./use-data-table-url-state";

  const props = withDefaults(
    defineProps<{
      readonly columns: DataTableColumns<TData>;
      readonly emptyStateLabel?: string;
      readonly enableGrouping?: boolean;
      readonly enableRowSelection?: boolean;
      readonly enableUrlState?: boolean;
      readonly facetableColumnIds?: readonly string[];
      readonly getRowId?: (row: TData, index: number) => string;
      readonly globalFilterPlaceholder?: string;
      readonly groupableColumnIds?: readonly string[];
      readonly hideToolbar?: boolean;
      readonly manualSorting?: boolean;
      readonly rows: TData[];
      readonly sorting?: SortingState;
      readonly tableId: string;
    }>(),
    {
      emptyStateLabel: "No records found.",
      enableGrouping: true,
      enableRowSelection: true,
      enableUrlState: true,
      facetableColumnIds: () => [],
      globalFilterPlaceholder: "Search loaded rows...",
      groupableColumnIds: () => [],
      hideToolbar: false,
      manualSorting: false,
      sorting: () => [],
    }
  );

  const emit = defineEmits<{
    "update:sorting": [value: SortingState];
  }>();

  const grouping = shallowRef<GroupingState>([]);
  const expanded = shallowRef<ExpandedState>({});
  const rowSelection = shallowRef<RowSelectionState>({});
  const columnVisibility = shallowRef<VisibilityState>({});

  const globalQuery = shallowRef<string>("");
  const activeFacets = shallowRef<Record<string, readonly string[]>>({});

  const filteredRows = computed<TData[]>(() => {
    const query = globalQuery.value.trim().toLowerCase();
    const activeFacetEntries = Object.entries(activeFacets.value).filter((entry) => {
      return entry[1].length > 0;
    });

    return props.rows.filter((row) => {
      if (!rowMatchesGlobalQuery(row, query)) {
        return false;
      }

      for (const [columnId, selectedTokens] of activeFacetEntries) {
        const rowFacetToken = toFacetToken(readRowValue(row, columnId));
        if (!selectedTokens.includes(rowFacetToken)) {
          return false;
        }
      }

      return true;
    });
  });

  function updateSorting(updater: Updater<SortingState>): void {
    emit("update:sorting", functionalUpdate(updater, props.sorting));
  }

  function updateGrouping(updater: Updater<GroupingState>): void {
    grouping.value = functionalUpdate(updater, grouping.value);
  }

  function updateExpanded(updater: Updater<ExpandedState>): void {
    expanded.value = functionalUpdate(updater, expanded.value);
  }

  function updateColumnVisibility(updater: Updater<VisibilityState>): void {
    columnVisibility.value = functionalUpdate(updater, columnVisibility.value);
  }

  function updateRowSelection(updater: Updater<RowSelectionState>): void {
    rowSelection.value = functionalUpdate(updater, rowSelection.value);
  }

  const table = useVueTable<TData>({
    get data() {
      return filteredRows.value;
    },
    get columns() {
      return props.columns;
    },
    get enableGrouping() {
      return props.enableGrouping;
    },
    get enableRowSelection() {
      return props.enableRowSelection;
    },
    get manualSorting() {
      return props.manualSorting;
    },
    state: {
      get sorting() {
        return props.sorting;
      },
      get grouping() {
        return grouping.value;
      },
      get expanded() {
        return expanded.value;
      },
      get rowSelection() {
        return rowSelection.value;
      },
      get columnVisibility() {
        return columnVisibility.value;
      },
    },
    getRowId: (row, index) => {
      const customRowId = props.getRowId?.(row, index);
      if (typeof customRowId === "string" && customRowId.length > 0) {
        return customRowId;
      }

      return String(index);
    },
    onSortingChange: updateSorting,
    onGroupingChange: updateGrouping,
    onExpandedChange: updateExpanded,
    onRowSelectionChange: updateRowSelection,
    onColumnVisibilityChange: updateColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const columnLabelById = computed<Record<string, string>>(() => {
    const labels: Record<string, string> = {};
    for (const column of table.getAllLeafColumns()) {
      const header = column.columnDef.header;
      if (typeof header === "string") {
        labels[column.id] = header;
      } else {
        labels[column.id] = column.id;
      }
    }

    return labels;
  });

  const facetableColumns = computed<readonly FacetableColumn[]>(() => {
    return createFacetableColumns({
      rows: props.rows,
      facetableColumnIds: props.facetableColumnIds,
      columnLabelById: columnLabelById.value,
    });
  });

  const facetableColumnById = computed<Readonly<Record<string, FacetableColumn>>>(() => {
    const nextById: Record<string, FacetableColumn> = {};
    for (const column of facetableColumns.value) {
      nextById[column.columnId] = column;
    }

    return nextById;
  });

  const groupableColumns = computed<readonly GroupableColumnOption[]>(() => {
    if (!props.enableGrouping) {
      return [];
    }

    const explicitGroupableColumns = props.groupableColumnIds;
    if (explicitGroupableColumns.length > 0) {
      return explicitGroupableColumns.map((columnId) => ({
        columnId,
        columnLabel: columnLabelById.value[columnId] ?? columnId,
      }));
    }

    return table.getAllLeafColumns().map((column) => ({
      columnId: column.id,
      columnLabel: columnLabelById.value[column.id] ?? column.id,
    }));
  });

  const hideableColumns = computed<readonly HideableColumnOption[]>(() => {
    return table
      .getAllLeafColumns()
      .filter((column) => column.getCanHide())
      .map((column) => ({
        columnId: column.id,
        columnLabel: columnLabelById.value[column.id] ?? column.id,
        visible: column.getIsVisible(),
        setVisible: (visible: boolean) => {
          column.toggleVisibility(visible);
        },
      }));
  });

  const visibleColumnCount = computed(() => {
    const rowSelectionColumnCount = props.enableRowSelection ? 1 : 0;
    return table.getVisibleLeafColumns().length + rowSelectionColumnCount;
  });

  const selectedRowCount = computed(() => table.getSelectedRowModel().rows.length);
  const isTableFiltered = computed<boolean>(() => {
    if (globalQuery.value.trim().length > 0) {
      return true;
    }

    if (grouping.value.length > 0 || selectedRowCount.value > 0) {
      return true;
    }

    return Object.values(activeFacets.value).some((tokens) => tokens.length > 0);
  });

  const filters = useDataTableFilters({
    activeFacets,
    facetableColumnById,
    globalQuery,
    onResetState: () => {
      grouping.value = [];
      rowSelection.value = {};
    },
  });

  function isColumnGrouped(columnId: string): boolean {
    return grouping.value.includes(columnId);
  }

  function toggleGrouping(columnId: string): void {
    if (isColumnGrouped(columnId)) {
      grouping.value = grouping.value.filter((groupedColumnId) => groupedColumnId !== columnId);
      return;
    }

    grouping.value = [...grouping.value, columnId];
  }

  const allRowsSelectionCheckboxState = computed<boolean | "indeterminate">(() => {
    if (table.getIsAllRowsSelected()) {
      return true;
    }

    if (table.getIsSomeRowsSelected()) {
      return "indeterminate";
    }

    return false;
  });

  function toggleAllRowsSelection(nextValue: boolean | "indeterminate"): void {
    const nextChecked = toCheckboxBoolean(nextValue);
    table.toggleAllRowsSelected(nextChecked);

    if (!nextChecked) {
      rowSelection.value = {};
    }
  }

  useDataTableUrlState({
    activeFacets,
    columnVisibility,
    enableUrlState: computed(() => props.enableUrlState),
    globalQuery,
    grouping,
    onSortingChange: (value) => emit("update:sorting", value),
    rowSelection,
    sorting: computed(() => props.sorting),
    tableId: computed(() => props.tableId),
  });
</script>

<template>
  <div class="space-y-2">
    <DataTableToolbar
      v-if="!props.hideToolbar"
      :clear-all-filters="filters.clearAllFilters"
      :filtered-row-count="filteredRows.length"
      :global-filter-placeholder="props.globalFilterPlaceholder"
      :global-query="globalQuery"
      :groupable-columns="groupableColumns"
      :grouping-count="grouping.length"
      :hideable-columns="hideableColumns"
      :is-column-grouped="isColumnGrouped"
      :is-table-filtered="isTableFiltered"
      :selected-row-count="selectedRowCount"
      :set-global-query="filters.setGlobalQuery"
      :toggle-grouping="toggleGrouping"
    />

    <div class="rounded-md border">
      <Table>
        <TableHeader class="sticky top-0 z-10 bg-background">
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead v-if="props.enableRowSelection" class="w-9">
              <Checkbox
                :checked="allRowsSelectionCheckboxState"
                @update:checked="toggleAllRowsSelection"
              />
            </TableHead>
            <TableHead v-for="header in headerGroup.headers" :key="header.id">
              <template v-if="!header.isPlaceholder">
                <div class="flex min-w-0 select-none items-center gap-1">
                  <DataTableFacetMenu
                    v-if="filters.facetableColumnForId(header.column.id) !== null"
                    :clear="() => filters.clearFacetsForColumn(header.column.id)"
                    :column-id="header.column.id"
                    :column-label="
                      filters.facetableColumnForId(header.column.id)?.columnLabel ?? header.column.id
                    "
                    :is-checked="
                      (token: string) => filters.facetValueChecked(header.column.id, token)
                    "
                    :is-open="filters.activeFacetColumnId.value === header.column.id"
                    :selected-count="filters.selectedFacetCount(header.column.id)"
                    :set-checked="
                      (token: string, checked: boolean) =>
                        filters.setFacetValueChecked(header.column.id, token, checked)
                    "
                    :set-open="(open: boolean) => filters.setFacetMenuOpen(header.column.id, open)"
                    :values="filters.facetValuesForColumn(header.column.id)"
                  >
                    <FlexRender
                      :render="header.column.columnDef.header"
                      :props="header.getContext()"
                    />
                  </DataTableFacetMenu>
                  <FlexRender
                    v-else
                    :render="header.column.columnDef.header"
                    :props="header.getContext()"
                  />
                  <button
                    v-if="header.column.getCanSort()"
                    type="button"
                    class="ml-1 inline-flex cursor-pointer items-center"
                    @click="header.column.toggleSorting()"
                  >
                    <ArrowUp v-if="header.column.getIsSorted() === 'asc'" class="h-4 w-4" />
                    <ArrowDown v-else-if="header.column.getIsSorted() === 'desc'" class="h-4 w-4" />
                    <ArrowUpDown v-else class="h-4 w-4 text-muted-foreground/50" />
                  </button>
                </div>
              </template>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          <template v-if="table.getRowModel().rows.length > 0">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() ? 'selected' : undefined"
              :class="row.getIsGrouped() ? 'bg-muted/50 font-medium' : undefined"
            >
              <TableCell v-if="props.enableRowSelection" class="w-9">
                <Checkbox
                  :checked="row.getIsSelected()"
                  :disabled="!row.getCanSelect()"
                  @update:checked="row.toggleSelected(toCheckboxBoolean($event))"
                />
              </TableCell>
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <template v-if="cell.getIsGrouped()">
                  <button
                    type="button"
                    class="flex items-center gap-1"
                    :style="{ paddingLeft: `${row.depth * 1.5}rem` }"
                    @click="row.toggleExpanded()"
                  >
                    <ChevronDown v-if="row.getIsExpanded()" class="h-4 w-4 shrink-0" />
                    <ChevronRight v-else class="h-4 w-4 shrink-0" />
                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    <Badge variant="secondary" class="ml-1 text-xs">
                      {{ row.subRows.length }}
                    </Badge>
                  </button>
                </template>
                <template v-else-if="cell.getIsAggregated()">
                  <span class="text-sm text-muted-foreground">
                    <FlexRender
                      :render="cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell"
                      :props="cell.getContext()"
                    />
                  </span>
                </template>
                <template v-else-if="cell.getIsPlaceholder()"></template>
                <template v-else>
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </template>
              </TableCell>
            </TableRow>
          </template>

          <TableRow v-else>
            <TableCell :colspan="visibleColumnCount" class="h-24 text-center text-muted-foreground">
              {{ props.emptyStateLabel }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
