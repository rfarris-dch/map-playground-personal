<script setup lang="ts">
  import { computed } from "vue";
  import {
    hasReleaseVerificationFailures,
    releaseVerificationGroups,
  } from "@/features/docs/release-verification.service";

  const groups = computed(() => releaseVerificationGroups);
  const hasFailures = computed(() => hasReleaseVerificationFailures);
</script>

<template>
  <section class="mt-16 border-t border-slate-200 pt-10 dark:border-slate-800">
    <div
      :class="
        hasFailures
          ? 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100'
          : 'border-emerald-200/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100'
      "
      class="rounded-2xl border px-5 py-4"
    >
      <p class="text-sm font-semibold">Live coverage audit</p>
      <p class="mt-2 text-sm leading-6">
        {{ hasFailures ? "One or more expected docs surfaces are missing from navigation or search." : "Representative onboarding, application, package, operations, reference, and contributor pages are all present in navigation and discoverable through the docs search index." }}
      </p>
    </div>

    <div class="mt-8 space-y-6">
      <section
        v-for="group in groups"
        :key="group.title"
        class="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/40 dark:shadow-none"
      >
        <h2 class="font-display text-xl tracking-tight text-slate-900 dark:text-white">
          {{ group.title }}
        </h2>
        <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {{ group.description }}
        </p>

        <ul class="mt-5 space-y-3">
          <li
            v-for="item in group.items"
            :key="item.slug"
            class="rounded-2xl border border-slate-200/80 px-4 py-4 dark:border-slate-800"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <RouterLink
                  :to="item.slug"
                  class="font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
                >
                  {{ item.label }}
                </RouterLink>
                <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Search query:
                  <code
                    class="rounded bg-slate-100 px-1.5 py-0.5 text-[0.8125rem] text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {{ item.searchQuery }}
                  </code>
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <span
                  :class="
                    item.navigationReady
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200'
                  "
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
                >
                  {{ item.navigationReady ? "Nav Ready" : "Nav Missing" }}
                </span>
                <span
                  :class="
                    item.searchReady
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200'
                  "
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
                >
                  {{ item.searchReady ? "Search Ready" : "Search Missing" }}
                </span>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>
