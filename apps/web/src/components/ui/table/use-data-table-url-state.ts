import type {
  GroupingState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/vue-table";
import { computed, type Ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  createColumnVisibilityState,
  createRowSelectionState,
  parsePersistedTableState,
  readQueryValue,
  serializeTableState,
  sortingStatesEqual,
} from "./data-table.service";

interface UseDataTableUrlStateOptions {
  readonly activeFacets: Ref<Record<string, readonly string[]>>;
  readonly columnVisibility: Ref<VisibilityState>;
  readonly enableUrlState: Readonly<Ref<boolean>>;
  readonly globalQuery: Ref<string>;
  readonly grouping: Ref<GroupingState>;
  readonly onSortingChange: (value: SortingState) => void;
  readonly rowSelection: Ref<RowSelectionState>;
  readonly sorting: Readonly<Ref<SortingState>>;
  readonly tableId: Readonly<Ref<string>>;
}

export function useDataTableUrlState(options: UseDataTableUrlStateOptions): void {
  const route = useRoute();
  const router = useRouter();
  const applyingUrlState = shallowRef<boolean>(false);
  const urlStateParamKey = computed(() => `table_${options.tableId.value}`);

  watch(
    () => route.query[urlStateParamKey.value],
    (queryValue) => {
      if (!options.enableUrlState.value) {
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
      options.globalQuery.value = typeof parsedState.q === "string" ? parsedState.q : "";
      options.activeFacets.value = parsedState.f ? { ...parsedState.f } : {};
      options.grouping.value = parsedState.g ? [...parsedState.g] : [];
      options.columnVisibility.value = createColumnVisibilityState(parsedState.v ?? []);
      options.rowSelection.value = createRowSelectionState(parsedState.x ?? []);

      if (parsedState.s && !sortingStatesEqual(parsedState.s, options.sorting.value)) {
        options.onSortingChange(parsedState.s);
      }

      applyingUrlState.value = false;
    },
    { immediate: true }
  );

  watch(
    () => [
      options.sorting.value,
      options.globalQuery.value,
      options.activeFacets.value,
      options.grouping.value,
      options.columnVisibility.value,
      options.rowSelection.value,
    ],
    () => {
      if (!options.enableUrlState.value || applyingUrlState.value) {
        return;
      }

      const serializedState = serializeTableState({
        sorting: options.sorting.value,
        globalQuery: options.globalQuery.value,
        activeFacets: options.activeFacets.value,
        grouping: options.grouping.value,
        columnVisibility: options.columnVisibility.value,
        rowSelection: options.rowSelection.value,
      });
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
}
