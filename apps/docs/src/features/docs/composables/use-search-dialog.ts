import { computed, onMounted, onUnmounted, shallowRef, watch } from "vue";
import { useRouter } from "vue-router";
import { useDocsContent } from "@/features/docs/composables/use-docs-content";

export function useSearchDialog() {
  const { search } = useDocsContent();
  const router = useRouter();
  const isOpen = shallowRef(false);
  const query = shallowRef("");
  const activeResultIndex = shallowRef(0);
  const results = computed(() => search(query.value));

  function resetSearch(): void {
    query.value = "";
    activeResultIndex.value = 0;
  }

  function openSearch(): void {
    isOpen.value = true;
  }

  function closeSearch(): void {
    isOpen.value = false;
    resetSearch();
  }

  async function navigateTo(slug: string): Promise<void> {
    await router.push(slug);
    closeSearch();
  }

  function moveActiveResult(step: number): void {
    if (results.value.length === 0) {
      return;
    }

    const nextIndex = activeResultIndex.value + step;
    if (nextIndex < 0) {
      activeResultIndex.value = results.value.length - 1;
      return;
    }

    activeResultIndex.value = nextIndex % results.value.length;
  }

  async function navigateToActiveResult(): Promise<void> {
    const activeResult = results.value[activeResultIndex.value];
    if (!activeResult) {
      return;
    }

    await navigateTo(activeResult.slug);
  }

  async function handleInputKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveResult(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveResult(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      await navigateToActiveResult();
      return;
    }

    if (event.key === "Escape" && query.value.trim().length === 0) {
      event.preventDefault();
      closeSearch();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();

      if (isOpen.value) {
        closeSearch();
        return;
      }

      openSearch();
    }
  }

  watch(query, () => {
    activeResultIndex.value = 0;
  });

  watch(results, (nextResults) => {
    if (nextResults.length === 0) {
      activeResultIndex.value = 0;
      return;
    }

    if (activeResultIndex.value >= nextResults.length) {
      activeResultIndex.value = 0;
    }
  });

  onMounted(() => {
    window.addEventListener("keydown", handleWindowKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleWindowKeydown);
  });

  return {
    activeResultIndex,
    closeSearch,
    handleInputKeydown,
    isOpen,
    navigateTo,
    openSearch,
    query,
    results,
  };
}
