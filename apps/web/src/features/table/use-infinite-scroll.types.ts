import type { Ref } from "vue";

export interface UseInfiniteScrollArgs {
  readonly canLoadMore: Ref<boolean>;
  readonly containerRef: Ref<HTMLElement | null>;
  readonly isLoadingMore: Ref<boolean>;
  readonly loadMore: () => Promise<void> | void;
  readonly sentinelRef: Ref<HTMLElement | null>;
}
