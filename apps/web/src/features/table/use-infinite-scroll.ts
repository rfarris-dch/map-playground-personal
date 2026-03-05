import { onBeforeUnmount, watch } from "vue";
import type { UseInfiniteScrollArgs } from "./use-infinite-scroll.types";

export function useInfiniteScroll(args: UseInfiniteScrollArgs): void {
  let observer: IntersectionObserver | null = null;
  let loadRequested = false;

  function disconnectObserver(): void {
    if (observer === null) {
      return;
    }

    observer.disconnect();
    observer = null;
  }

  function connectObserver(): void {
    disconnectObserver();

    const container = args.containerRef.value;
    const sentinel = args.sentinelRef.value;
    if (!(container && sentinel)) {
      return;
    }

    observer = new IntersectionObserver(
      async (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);
        if (!(isVisible && args.canLoadMore.value)) {
          return;
        }

        if (args.isLoadingMore.value || loadRequested) {
          return;
        }

        loadRequested = true;
        try {
          await args.loadMore();
        } finally {
          loadRequested = false;
        }
      },
      {
        root: container,
        rootMargin: "0px 0px 320px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
  }

  watch(
    () => [args.containerRef.value, args.sentinelRef.value],
    () => {
      connectObserver();
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    disconnectObserver();
  });
}
