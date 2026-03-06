<script setup lang="ts">
  import { Dialog, DialogPanel } from "@headlessui/vue";
  import { nextTick, useTemplateRef, watch } from "vue";
  import { useSearchDialog } from "@/features/docs/composables/use-search-dialog";

  const inputRef = useTemplateRef<HTMLInputElement>("searchInput");
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
</script>

<template>
  <div>
    <button
      type="button"
      class="group flex h-6 w-6 items-center justify-center sm:justify-start md:h-auto md:w-[28rem] md:flex-none md:gap-3 md:rounded-full md:bg-white/90 md:px-4 md:py-3 md:text-left md:text-sm md:text-slate-500 md:shadow-lg md:ring-1 md:shadow-slate-900/10 md:ring-slate-900/10 md:transition md:hover:bg-white lg:w-[32rem] xl:w-[36rem] dark:md:bg-slate-800/90 dark:md:text-slate-400 dark:md:ring-white/10"
      @click="openSearch"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        class="h-5 w-5 fill-slate-400 group-hover:fill-slate-500 md:group-hover:fill-slate-400 dark:fill-slate-500"
      >
        <path
          d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"
        />
      </svg>
      <span class="sr-only md:not-sr-only md:grow">Find docs, packages, and workflows…</span>
      <span
        class="hidden rounded-md border border-slate-200 px-2 py-0.5 text-xs text-slate-400 md:inline-flex dark:border-slate-700"
        >⌘K</span
      >
    </button>

    <Dialog :open="isOpen" class="relative z-50" @close="closeSearch">
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" aria-hidden="true" />
      <div class="fixed inset-0 overflow-y-auto p-4 sm:p-6 md:p-20">
        <DialogPanel
          class="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 shadow-slate-900/10 ring-slate-900/10 dark:bg-slate-900 dark:ring-white/10"
        >
          <div
            class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" class="h-5 w-5 fill-slate-400">
              <path
                d="M16.293 17.707a1 1 0 0 0 1.414-1.414l-1.414 1.414ZM9 14a5 5 0 0 1-5-5H2a7 7 0 0 0 7 7v-2ZM4 9a5 5 0 0 1 5-5V2a7 7 0 0 0-7 7h2Zm5-5a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7v2Zm8.707 12.293-3.757-3.757-1.414 1.414 3.757 3.757 1.414-1.414ZM14 9a4.98 4.98 0 0 1-1.464 3.536l1.414 1.414A6.98 6.98 0 0 0 16 9h-2Zm-1.464 3.536A4.98 4.98 0 0 1 9 14v2a6.98 6.98 0 0 0 4.95-2.05l-1.414-1.414Z"
              />
            </svg>
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              class="h-10 w-full border-0 bg-transparent text-sm text-slate-900 outline-hidden placeholder:text-slate-400 dark:text-white"
              placeholder="Search routes, packages, scripts, and runbooks"
              @keydown="handleInputKeydown"
            >
            <button
              type="button"
              class="text-sm text-slate-500 dark:text-slate-400"
              @click="closeSearch"
            >
              Esc
            </button>
          </div>

          <div class="max-h-[60vh] overflow-y-auto p-3">
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
                :aria-selected="index === activeResultIndex"
              >
                <button
                  type="button"
                  class="block w-full rounded-lg px-3 py-2 text-left"
                  :class="
                    index === activeResultIndex
                      ? 'bg-slate-100 dark:bg-slate-700/30'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  "
                  @click="navigateTo(result.slug)"
                >
                  <div
                    class="text-sm"
                    :class="
                      index === activeResultIndex
                        ? 'text-sky-600 dark:text-sky-400'
                        : 'text-slate-700 dark:text-slate-300'
                    "
                  >
                    {{ result.title }}
                  </div>
                  <div class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {{ result.sectionTitle }}
                    / {{ result.description }}
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
