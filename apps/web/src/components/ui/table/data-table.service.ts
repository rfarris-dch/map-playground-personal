import type {
  GroupingState,
  RowData,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/vue-table";
import type {
  ColumnLabelById,
  FacetableColumn,
  FacetSelectionState,
  FacetValue,
  PersistedDataTableState,
} from "./data-table.types";

const EMPTY_FACET_TOKEN = "__empty__";
const MAX_SELECTED_IDS_IN_URL = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  return String(value).trim().toLowerCase();
}

export function toFacetToken(value: unknown): string {
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

function parseFacetState(value: unknown): FacetSelectionState {
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

export function toCheckboxBoolean(value: boolean | "indeterminate"): boolean {
  return value === true;
}

export function readQueryValue(value: unknown): string | null {
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

export function readRowValue<TData extends RowData>(row: TData, columnId: string): unknown {
  if (!isRecord(row)) {
    return null;
  }

  return Reflect.get(row, columnId);
}

export function rowMatchesGlobalQuery<TData extends RowData>(row: TData, query: string): boolean {
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

export function createFacetableColumns<TData extends RowData>(args: {
  readonly columnLabelById: ColumnLabelById;
  readonly facetableColumnIds: readonly string[];
  readonly rows: readonly TData[];
}): readonly FacetableColumn[] {
  return args.facetableColumnIds
    .map((columnId) => {
      const valuesByToken = new Map<string, number>();
      for (const row of args.rows) {
        const token = toFacetToken(readRowValue(row, columnId));
        const currentCount = valuesByToken.get(token) ?? 0;
        valuesByToken.set(token, currentCount + 1);
      }

      const values: FacetValue[] = [...valuesByToken.entries()]
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
        columnLabel: args.columnLabelById[columnId] ?? columnId,
        values,
      };
    })
    .filter((entry) => entry.values.length > 0);
}

export function sortingStatesEqual(
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

export function createColumnVisibilityState(hiddenColumnIds: readonly string[]): VisibilityState {
  const visibilityState: VisibilityState = {};
  for (const columnId of hiddenColumnIds) {
    visibilityState[columnId] = false;
  }

  return visibilityState;
}

export function createRowSelectionState(selectedRowIds: readonly string[]): RowSelectionState {
  const selectionState: RowSelectionState = {};
  for (const rowId of selectedRowIds) {
    selectionState[rowId] = true;
  }

  return selectionState;
}

export function serializeTableState(args: {
  readonly activeFacets: FacetSelectionState;
  readonly columnVisibility: VisibilityState;
  readonly globalQuery: string;
  readonly grouping: GroupingState;
  readonly rowSelection: RowSelectionState;
  readonly sorting: SortingState;
}): string | null {
  const nextFacets: Record<string, readonly string[]> = {};
  for (const [columnId, facetTokens] of Object.entries(args.activeFacets)) {
    if (facetTokens.length > 0) {
      nextFacets[columnId] = facetTokens;
    }
  }

  const hiddenColumnIds = Object.entries(args.columnVisibility)
    .filter((entry) => entry[1] === false)
    .map((entry) => entry[0]);

  const selectedRowIds = Object.entries(args.rowSelection)
    .filter((entry) => entry[1] === true)
    .map((entry) => entry[0])
    .slice(0, MAX_SELECTED_IDS_IN_URL);

  const persistedState: PersistedDataTableState = {
    s: args.sorting.length > 0 ? args.sorting : undefined,
    q: args.globalQuery.trim().length > 0 ? args.globalQuery.trim() : undefined,
    f: Object.keys(nextFacets).length > 0 ? nextFacets : undefined,
    g: args.grouping.length > 0 ? args.grouping : undefined,
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

export function parsePersistedTableState(serialized: string): PersistedDataTableState | null {
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
