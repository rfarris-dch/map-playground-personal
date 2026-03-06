<script setup lang="ts">
  import { Dialog, DialogPanel } from "@headlessui/vue";
  import { nextTick, onMounted, shallowRef, useTemplateRef, watch } from "vue";
  import { useSearchDialog } from "@/features/docs/composables/use-search-dialog";

  const applePlatformPattern = /(Mac|iPhone|iPod|iPad)/i;
  const inputRef = useTemplateRef<HTMLInputElement>("searchInput");
  const modifierKey = shallowRef("⌘");
  const {
    activeResultIndex,
    closeSearch,
    handleInputKeydown,
    isOpen,
    navigateTo,
    openSearch,
    query,
    results,
  } = useSearchDialog();

  watch(isOpen, async (open) => {
    if (!open) {
      return;
    }

    await nextTick();
    inputRef.value?.focus();
  });

  onMounted(() => {
    modifierKey.value = applePlatformPattern.test(navigator.platform) ? "⌘" : "Ctrl ";
  });
</script>

<template>
  <div>
    <button
      type="button"
      class="group flex h-6 w-6 items-center justify-center sm:justify-start md:h-auto md:w-80 md:flex-none md:rounded-lg md:py-2.5 md:pr-3.5 md:pl-4 md:text-sm md:ring-1 md:ring-slate-200 md:hover:ring-slate-300 lg:w-96 dark:md:bg-slate-800/75 dark:md:ring-white/5 dark:md:ring-inset dark:md:hover:bg-slate-700/40 dark:md:hover:ring-slate-500"
      @click="openSearch"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        class="h-5 w-5 flex-none fill-slate-400 group-hover:fill-slate-500 md:group-hover:fill-slate-400 dark:fill-slate-500"
      >
        <path
          d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"
        />
      </svg>
      <span class="sr-only md:ml-2 md:not-sr-only md:text-slate-500 md:dark:text-slate-400">
        Search docs
      </span>
      <kbd class="ml-auto hidden font-medium text-slate-400 md:block dark:text-slate-500">
        <kbd class="font-sans">{{ modifierKey }}</kbd>
        <kbd class="font-sans">K</kbd>
      </kbd>
    </button>

    <Dialog :open="isOpen" class="fixed inset-0 z-50" @close="closeSearch">
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
      <div
        class="fixed inset-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-20 md:py-32 lg:px-8 lg:py-[15vh]"
      >
        <DialogPanel
          class="mx-auto transform-gpu overflow-hidden rounded-xl bg-white shadow-xl sm:max-w-xl dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
        >
          <div class="group relative flex h-12">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              class="pointer-events-none absolute top-0 left-4 h-full w-5 fill-slate-400 dark:fill-slate-500"
            >
              <path
                d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"
              />
            </svg>
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              class="flex-auto appearance-none bg-transparent pr-4 pl-12 text-slate-900 outline-hidden placeholder:text-slate-400 focus:w-full focus:flex-none sm:text-sm dark:text-white [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
              placeholder="Find docs, packages, and workflows..."
              @keydown="handleInputKeydown"
            >
          </div>

          <div
            class="max-h-[60vh] overflow-y-auto border-t border-slate-200 bg-white px-2 py-3 empty:hidden dark:border-slate-400/10 dark:bg-slate-800"
          >
            <p
              v-if="query.trim().length < 2"
              class="px-4 py-8 text-center text-sm text-slate-700 dark:text-slate-400"
            >
              Type at least two characters to search the docs.
            </p>

            <p
              v-else-if="results.length === 0"
              class="px-4 py-8 text-center text-sm text-slate-700 dark:text-slate-400"
            >
              No results for “<span class="text-slate-900 dark:text-white">{{ query }}</span>”.
            </p>

            <ul v-else role="listbox" class="space-y-1">
              <li
                v-for="(result, index) in results"
                :key="result.slug"
                class="group rounded-lg aria-selected:bg-slate-100 dark:aria-selected:bg-slate-700/30"
                :aria-selected="index === activeResultIndex"
              >
                <button
                  type="button"
                  class="block w-full cursor-default rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  @click="navigateTo(result.slug)"
                >
                  <div
                    class="text-sm text-slate-700 group-aria-selected:text-sky-600 dark:text-slate-300 dark:group-aria-selected:text-sky-400"
                  >
                    {{ result.title }}
                  </div>
                  <div
                    class="mt-0.5 truncate whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"
                  >
                    {{ result.sectionTitle }}
                    <template v-if="result.pageTitle"> / {{ result.pageTitle }} </template>
                    <template v-else-if="result.description.length > 0">
                      / {{ result.description }}
                    </template>
                  </div>
                </button>
              </li>
            </ul>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  </div>
</template>
