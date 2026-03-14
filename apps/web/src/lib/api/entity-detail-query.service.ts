import { type QueryKey, useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";

interface CreateEntityDetailQueryOptions<TSelected, TValue> {
  readonly buildQueryKey: (selected: TSelected) => QueryKey;
  readonly isEnabled: (selected: TSelected) => boolean;
  readonly query: (args: {
    readonly queryKey: QueryKey;
    readonly signal: AbortSignal;
  }) => Promise<TValue>;
  readonly selected: Ref<TSelected>;
}

export function createEntityDetailQuery<TSelected, TValue>(
  options: CreateEntityDetailQueryOptions<TSelected, TValue>
) {
  const queryKey = computed<QueryKey>(() => options.buildQueryKey(options.selected.value));
  const enabled = computed(() => options.isEnabled(options.selected.value));

  return useQuery<TValue, Error>({
    enabled,
    queryFn({ queryKey: activeQueryKey, signal }) {
      return options.query({
        queryKey: activeQueryKey,
        signal,
      });
    },
    queryKey,
  });
}
