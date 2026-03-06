import { type Ref, shallowRef } from "vue";
import type { FacetableColumn, FacetValue } from "./data-table.types";

interface UseDataTableFiltersArgs {
  readonly activeFacets: Ref<Record<string, readonly string[]>>;
  readonly facetableColumnById: Readonly<Ref<Readonly<Record<string, FacetableColumn>>>>;
  readonly globalQuery: Ref<string>;
  readonly onResetState: () => void;
}

export function useDataTableFilters(args: UseDataTableFiltersArgs) {
  const activeFacetColumnId = shallowRef<string | null>(null);

  function selectedFacetTokens(columnId: string): readonly string[] {
    return args.activeFacets.value[columnId] ?? [];
  }

  function selectedFacetCount(columnId: string): number {
    return selectedFacetTokens(columnId).length;
  }

  function facetableColumnForId(columnId: string): FacetableColumn | null {
    return args.facetableColumnById.value[columnId] ?? null;
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

      args.activeFacets.value = {
        ...args.activeFacets.value,
        [columnId]: [...currentValues, token],
      };
      return;
    }

    const nextValues = currentValues.filter((value) => value !== token);
    args.activeFacets.value = {
      ...args.activeFacets.value,
      [columnId]: nextValues,
    };
  }

  function clearFacetsForColumn(columnId: string): void {
    args.activeFacets.value = {
      ...args.activeFacets.value,
      [columnId]: [],
    };
  }

  function clearAllFilters(): void {
    args.globalQuery.value = "";
    args.activeFacets.value = {};
    activeFacetColumnId.value = null;
    args.onResetState();
  }

  function setGlobalQuery(nextValue: unknown): void {
    args.globalQuery.value = String(nextValue);
  }

  return {
    activeFacetColumnId,
    clearAllFilters,
    clearFacetsForColumn,
    facetableColumnForId,
    facetValueChecked,
    facetValuesForColumn,
    selectedFacetCount,
    setFacetMenuOpen,
    setFacetValueChecked,
    setGlobalQuery,
  };
}
