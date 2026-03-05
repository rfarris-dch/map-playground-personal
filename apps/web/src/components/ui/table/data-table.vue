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
    type TableOptionsWithReactiveData,
    type Updater,
    useVueTable,
    type VisibilityState,
  } from "@tanstack/vue-table";
  import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-vue-next";
  import { computed, shallowRef, watch } from "vue";
  import { useRoute, useRouter } from "vue-router";
  import Badge from "@/components/ui/badge/badge.vue";
  import Button from "@/components/ui/button/button.vue";
  import Checkbox from "@/components/ui/checkbox/checkbox.vue";
  import DropdownMenu from "@/components/ui/dropdown-menu/dropdown-menu.vue";
  import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.vue";
  import DropdownMenuLabel from "@/components/ui/dropdown-menu/dropdown-menu-label.vue";
  import DropdownMenuSeparator from "@/components/ui/dropdown-menu/dropdown-menu-separator.vue";
  import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.vue";
  import Input from "@/components/ui/input/input.vue";
  import Table from "@/components/ui/table/table.vue";
  import TableBody from "@/components/ui/table/table-body.vue";
  import TableCell from "@/components/ui/table/table-cell.vue";
  import TableHead from "@/components/ui/table/table-head.vue";
  import TableHeader from "@/components/ui/table/table-header.vue";
  import TableRow from "@/components/ui/table/table-row.vue";

  type DataTableColumns<TEntry extends RowData> = Exclude<
    TableOptionsWithReactiveData<TEntry>["columns"],
    undefined
  >;

  interface PersistedDataTableState {
    readonly f?: Readonly<Record<string, readonly string[]>> | undefined;
    readonly g?: readonly string[] | undefined;
    readonly q?: string | undefined;
    readonly s?: SortingState | undefined;
    readonly v?: readonly string[] | undefined;
    readonly x?: readonly string[] | undefined;
  }

  interface FacetValue {
    readonly count: number;
    readonly label: string;
    readonly token: string;
  }

  interface FacetableColumn {
    readonly columnId: string;
    readonly columnLabel: string;
    readonly values: readonly FacetValue[];
  }

  const EMPTY_FACET_TOKEN = "__empty__";
  const MAX_SELECTED_IDS_IN_URL = 100;

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

  const route = useRoute();
  const router = useRouter();
  const globalQuery = shallowRef<string>("");
  const activeFacets = shallowRef<Record<string, readonly string[]>>({});
  const grouping = shallowRef<GroupingState>([]);
  const expanded = shallowRef<ExpandedState>({});
  const rowSelection = shallowRef<RowSelectionState>({});
  const columnVisibility = shallowRef<VisibilityState>({});
  const applyingUrlState = shallowRef<boolean>(false);
  const activeFacetColumnId = shallowRef<string | null>(null);

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
  }

  function toCheckboxBoolean(value: boolean | "indeterminate"): boolean {
    return value === true;
  }

  function normalizeString(value: unknown): string {
    if (value === null || typeof value === "undefined") {
      return "";
    }

    return String(value).trim().toLowerCase();
  }

  function readQueryValue(value: unknown): string | null {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      const firstValue = value[0];
      if (typeof firstValue === "string") {
        return firstValue;
      }
    }

    return null;
  }

  function toFacetToken(value: unknown): string {
    if (value === null || typeof value === "undefined") {
      return EMPTY_FACET_TOKEN;
    }

    const normalized = String(value).trim();
    if (normalized.length === 0) {
      return EMPTY_FACET_TOKEN;
    }

    return normalized;
  }

  function toFacetLabel(token: string): string {
    if (token === EMPTY_FACET_TOKEN) {
      return "—";
    }

    return token;
  }

  function readRowValue(row: TData, columnId: string): unknown {
    if (!isRecord(row)) {
      return null;
    }

    return Reflect.get(row, columnId);
  }

  function rowMatchesGlobalQuery(row: TData, query: string): boolean {
    if (query.length === 0) {
      return true;
    }

    if (!isRecord(row)) {
      return false;
    }

    for (const value of Object.values(row)) {
      if (normalizeString(value).includes(query)) {
        return true;
      }
    }

    return false;
  }

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

  const urlStateParamKey = computed(() => `table_${props.tableId}`);

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
    return props.facetableColumnIds
      .map((columnId) => {
        const valuesByToken = new Map<string, number>();
        for (const row of props.rows) {
          const token = toFacetToken(readRowValue(row, columnId));
          const currentCount = valuesByToken.get(token) ?? 0;
          valuesByToken.set(token, currentCount + 1);
        }

        const values = [...valuesByToken.entries()]
          .map((entry) => ({
            token: entry[0],
            label: toFacetLabel(entry[0]),
            count: entry[1],
          }))
          .sort((left, right) => {
            if (right.count !== left.count) {
              return right.count - left.count;
            }

            return left.label.localeCompare(right.label);
          });

        return {
          columnId,
          columnLabel: columnLabelById.value[columnId] ?? columnId,
          values,
        };
      })
      .filter((entry) => entry.values.length > 0);
  });

  const facetableColumnById = computed<Readonly<Record<string, FacetableColumn>>>(() => {
    const nextById: Record<string, FacetableColumn> = {};
    for (const column of facetableColumns.value) {
      nextById[column.columnId] = column;
    }

    return nextById;
  });

  const groupableColumns = computed(() => {
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

  const hideableColumns = computed(() => {
    return table.getAllLeafColumns().filter((column) => column.getCanHide());
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

  function selectedFacetTokens(columnId: string): readonly string[] {
    return activeFacets.value[columnId] ?? [];
  }

  function selectedFacetCount(columnId: string): number {
    return selectedFacetTokens(columnId).length;
  }

  function facetableColumnForId(columnId: string): FacetableColumn | null {
    return facetableColumnById.value[columnId] ?? null;
  }

  function setFacetMenuOpen(columnId: string, nextOpen: boolean): void {
    if (nextOpen) {
      activeFacetColumnId.value = columnId;
      return;
    }

    if (activeFacetColumnId.value === columnId) {
      activeFacetColumnId.value = null;
    }
  }

  function facetValuesForColumn(columnId: string): readonly FacetValue[] {
    const facetableColumn = facetableColumnForId(columnId);
    if (facetableColumn === null) {
      return [];
    }

    return facetableColumn.values;
  }

  function facetValueChecked(columnId: string, token: string): boolean {
    return selectedFacetTokens(columnId).includes(token);
  }

  function setFacetValueChecked(columnId: string, token: string, checked: boolean): void {
    const currentValues = selectedFacetTokens(columnId);
    if (checked) {
      if (currentValues.includes(token)) {
        return;
      }

      activeFacets.value = {
        ...activeFacets.value,
        [columnId]: [...currentValues, token],
      };
      return;
    }

    const nextValues = currentValues.filter((value) => value !== token);
    activeFacets.value = {
      ...activeFacets.value,
      [columnId]: nextValues,
    };
  }

  function clearFacetsForColumn(columnId: string): void {
    activeFacets.value = {
      ...activeFacets.value,
      [columnId]: [],
    };
  }

  function clearAllFilters(): void {
    globalQuery.value = "";
    activeFacets.value = {};
    activeFacetColumnId.value = null;
    grouping.value = [];
    rowSelection.value = {};
  }

  function clearRowSelection(): void {
    rowSelection.value = {};
  }

  function setGlobalQuery(nextValue: unknown): void {
    globalQuery.value = String(nextValue);
  }

  function parseStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item) => typeof item === "string");
  }

  function parseSortingState(value: unknown): SortingState {
    if (!Array.isArray(value)) {
      return [];
    }

    const sortingState: SortingState = [];
    for (const item of value) {
      if (!isRecord(item)) {
        continue;
      }

      const id = Reflect.get(item, "id");
      const desc = Reflect.get(item, "desc");
      if (typeof id === "string" && typeof desc === "boolean") {
        sortingState.push({ id, desc });
      }
    }

    return sortingState;
  }

  function sortingStatesEqual(
    leftSortingState: readonly { readonly id: string; readonly desc: boolean }[],
    rightSortingState: readonly { readonly id: string; readonly desc: boolean }[]
  ): boolean {
    if (leftSortingState.length !== rightSortingState.length) {
      return false;
    }

    for (let index = 0; index < leftSortingState.length; index += 1) {
      const leftEntry = leftSortingState[index];
      const rightEntry = rightSortingState[index];
      if (typeof leftEntry === "undefined" || typeof rightEntry === "undefined") {
        return false;
      }

      if (leftEntry.id !== rightEntry.id || leftEntry.desc !== rightEntry.desc) {
        return false;
      }
    }

    return true;
  }

  function parseFacetState(value: unknown): Record<string, readonly string[]> {
    if (!isRecord(value)) {
      return {};
    }

    const facetState: Record<string, readonly string[]> = {};
    for (const [columnId, facetTokens] of Object.entries(value)) {
      const parsedTokens = parseStringArray(facetTokens);
      if (parsedTokens.length > 0) {
        facetState[columnId] = parsedTokens;
      }
    }

    return facetState;
  }

  function serializeTableState(): string | null {
    const nextFacets: Record<string, readonly string[]> = {};
    for (const [columnId, facetTokens] of Object.entries(activeFacets.value)) {
      if (facetTokens.length > 0) {
        nextFacets[columnId] = facetTokens;
      }
    }

    const hiddenColumnIds = Object.entries(columnVisibility.value)
      .filter((entry) => entry[1] === false)
      .map((entry) => entry[0]);

    const selectedRowIds = Object.entries(rowSelection.value)
      .filter((entry) => entry[1] === true)
      .map((entry) => entry[0])
      .slice(0, MAX_SELECTED_IDS_IN_URL);

    const persistedState: PersistedDataTableState = {
      s: props.sorting.length > 0 ? props.sorting : undefined,
      q: globalQuery.value.trim().length > 0 ? globalQuery.value.trim() : undefined,
      f: Object.keys(nextFacets).length > 0 ? nextFacets : undefined,
      g: grouping.value.length > 0 ? grouping.value : undefined,
      v: hiddenColumnIds.length > 0 ? hiddenColumnIds : undefined,
      x: selectedRowIds.length > 0 ? selectedRowIds : undefined,
    };

    if (
      typeof persistedState.s === "undefined" &&
      typeof persistedState.q === "undefined" &&
      typeof persistedState.f === "undefined" &&
      typeof persistedState.g === "undefined" &&
      typeof persistedState.v === "undefined" &&
      typeof persistedState.x === "undefined"
    ) {
      return null;
    }

    return JSON.stringify(persistedState);
  }

  function parsePersistedTableState(serialized: string): PersistedDataTableState | null {
    try {
      const parsed = JSON.parse(serialized);
      if (!isRecord(parsed)) {
        return null;
      }

      const parsedQuery = Reflect.get(parsed, "q");
      const nextQuery = typeof parsedQuery === "string" ? parsedQuery : undefined;
      const nextSorting = parseSortingState(Reflect.get(parsed, "s"));
      const nextFacets = parseFacetState(Reflect.get(parsed, "f"));
      const nextGrouping = parseStringArray(Reflect.get(parsed, "g"));
      const nextHiddenColumns = parseStringArray(Reflect.get(parsed, "v"));
      const nextSelection = parseStringArray(Reflect.get(parsed, "x"));

      return {
        s: nextSorting.length > 0 ? nextSorting : undefined,
        q: nextQuery,
        f: Object.keys(nextFacets).length > 0 ? nextFacets : undefined,
        g: nextGrouping.length > 0 ? nextGrouping : undefined,
        v: nextHiddenColumns.length > 0 ? nextHiddenColumns : undefined,
        x: nextSelection.length > 0 ? nextSelection : undefined,
      };
    } catch {
      return null;
    }
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
      clearRowSelection();
    }
  }

  watch(
    () => route.query[urlStateParamKey.value],
    (queryValue) => {
      if (!props.enableUrlState) {
        return;
      }

      const serializedState = readQueryValue(queryValue);
      if (serializedState === null) {
        return;
      }

      const parsedState = parsePersistedTableState(serializedState);
      if (parsedState === null) {
        return;
      }

      applyingUrlState.value = true;

      globalQuery.value = typeof parsedState.q === "string" ? parsedState.q : "";

      activeFacets.value = parsedState.f ? { ...parsedState.f } : {};
      grouping.value = parsedState.g ? [...parsedState.g] : [];

      const visibilityState: VisibilityState = {};
      if (parsedState.v) {
        for (const columnId of parsedState.v) {
          visibilityState[columnId] = false;
        }
      }
      columnVisibility.value = visibilityState;

      const selectionState: RowSelectionState = {};
      if (parsedState.x) {
        for (const rowId of parsedState.x) {
          selectionState[rowId] = true;
        }
      }
      rowSelection.value = selectionState;

      if (parsedState.s && !sortingStatesEqual(parsedState.s, props.sorting)) {
        emit("update:sorting", parsedState.s);
      }

      applyingUrlState.value = false;
    },
    { immediate: true }
  );

  watch(
    () => [
      props.sorting,
      globalQuery.value,
      activeFacets.value,
      grouping.value,
      columnVisibility.value,
      rowSelection.value,
    ],
    () => {
      if (!props.enableUrlState || applyingUrlState.value) {
        return;
      }

      const serializedState = serializeTableState();
      const currentState = readQueryValue(route.query[urlStateParamKey.value]);
      if (serializedState === currentState) {
        return;
      }

      const nextQuery = {
        ...route.query,
      };

      if (serializedState === null) {
        delete nextQuery[urlStateParamKey.value];
      } else {
        nextQuery[urlStateParamKey.value] = serializedState;
      }

      router.replace({ query: nextQuery }).catch(() => {
        return undefined;
      });
    },
    { deep: true }
  );
</script>

<template>
  <div class="space-y-2">
    <div v-if="!props.hideToolbar" class="flex flex-col gap-2">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center space-x-2">
          <Input
            :model-value="globalQuery"
            class="h-8 w-[150px] lg:w-[250px]"
            :placeholder="props.globalFilterPlaceholder"
            @update:model-value="setGlobalQuery"
          />
          <Button
            v-if="isTableFiltered"
            size="sm"
            variant="ghost"
            class="h-8 px-2 lg:px-3"
            @click="clearAllFilters"
          >
            Reset
          </Button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="whitespace-nowrap text-sm text-muted-foreground">
            {{ filteredRows.length.toLocaleString() }}
            rows
          </span>
          <DropdownMenu v-if="groupableColumns.length > 0">
            <DropdownMenuTrigger as-child>
              <Button size="sm" variant="outline" class="h-8">
                Group by
                <span
                  v-if="grouping.length > 0"
                  class="ml-2 rounded-sm bg-muted px-1 font-normal text-[10px] leading-4 text-muted-foreground"
                >
                  {{ grouping.length }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-56 p-2">
              <DropdownMenuLabel class="px-1 py-1.5">Grouping</DropdownMenuLabel>
              <DropdownMenuSeparator class="my-1" />
              <div class="space-y-1">
                <label
                  v-for="groupColumn in groupableColumns"
                  :key="groupColumn.columnId"
                  class="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
                >
                  <span class="truncate">{{ groupColumn.columnLabel }}</span>
                  <Checkbox
                    :checked="isColumnGrouped(groupColumn.columnId)"
                    @update:checked="toggleGrouping(groupColumn.columnId)"
                  />
                </label>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu v-if="hideableColumns.length > 0">
            <DropdownMenuTrigger as-child>
              <Button size="sm" variant="outline" class="h-8">Columns</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="w-56 p-2">
              <DropdownMenuLabel class="px-1 py-1.5">Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator class="my-1" />
              <div class="space-y-1">
                <label
                  v-for="column in hideableColumns"
                  :key="column.id"
                  class="flex items-center justify-between gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
                >
                  <span class="truncate">{{ columnLabelById[column.id] ?? column.id }}</span>
                  <Checkbox
                    :checked="column.getIsVisible()"
                    @update:checked="column.toggleVisibility(toCheckboxBoolean($event))"
                  />
                </label>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="selectedRowCount > 0" class="text-xs text-muted-foreground">
          {{ selectedRowCount.toLocaleString() }}
          selected
        </span>
      </div>
    </div>

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
                  <DropdownMenu
                    v-if="facetableColumnForId(header.column.id) !== null"
                    :open="activeFacetColumnId === header.column.id"
                    @update:open="setFacetMenuOpen(header.column.id, $event)"
                  >
                    <DropdownMenuTrigger as-child>
                      <button
                        type="button"
                        class="truncate text-left transition-colors hover:text-foreground"
                        :class="
                          selectedFacetCount(header.column.id) > 0
                            ? 'text-primary underline'
                            : undefined
                        "
                        :aria-label="`Filter ${facetableColumnForId(header.column.id)?.columnLabel ?? header.column.id}`"
                      >
                        <FlexRender
                          :render="header.column.columnDef.header"
                          :props="header.getContext()"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" class="w-64 p-0">
                      <DropdownMenuLabel
                        class="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5"
                      >
                        <span>{{ facetableColumnForId(header.column.id)?.columnLabel }}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          class="h-6 px-2 text-[11px]"
                          @click="clearFacetsForColumn(header.column.id)"
                        >
                          Clear
                        </Button>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator class="my-0" />
                      <div class="max-h-64 space-y-1 overflow-y-auto p-2">
                        <label
                          v-for="facetOption in facetValuesForColumn(header.column.id)"
                          :key="`${header.column.id}:${facetOption.token}`"
                          class="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/40"
                        >
                          <span class="inline-flex items-center gap-2">
                            <Checkbox
                              :checked="facetValueChecked(header.column.id, facetOption.token)"
                              @update:checked="
                              setFacetValueChecked(
                                header.column.id,
                                facetOption.token,
                                toCheckboxBoolean($event)
                              )
                            "
                            />
                            <span class="truncate">{{ facetOption.label }}</span>
                          </span>
                          <span class="text-[11px] text-muted-foreground"
                            >{{ facetOption.count }}</span
                          >
                        </label>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
