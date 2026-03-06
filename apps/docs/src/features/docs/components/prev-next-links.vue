<script setup lang="ts">
  import type { DocsPage } from "@/features/docs/docs-content.types";

  defineProps<{
    previous: DocsPage | undefined;
    next: DocsPage | undefined;
  }>();
</script>

<template>
  <dl
    v-if="previous || next"
    class="mt-12 flex border-t border-slate-200 pt-6 dark:border-slate-800"
  >
    <div v-if="previous">
      <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Previous</dt>
      <dd class="mt-1">
        <RouterLink
          :to="previous.slug"
          class="flex flex-row-reverse items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {{ previous.title }}
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            class="h-4 w-4 flex-none -scale-x-100 fill-current"
          >
            <path
              d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"
            />
          </svg>
        </RouterLink>
      </dd>
    </div>
    <div v-if="next" class="ml-auto text-right">
      <dt class="font-display text-sm font-medium text-slate-900 dark:text-white">Next</dt>
      <dd class="mt-1">
        <RouterLink
          :to="next.slug"
          class="flex items-center gap-x-1 text-base font-semibold text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {{ next.title }}
          <svg viewBox="0 0 16 16" aria-hidden="true" class="h-4 w-4 flex-none fill-current">
            <path
              d="m9.182 13.423-1.17-1.16 3.505-3.505H3V7.065h8.517l-3.506-3.5L9.181 2.4l5.512 5.511-5.511 5.512Z"
            />
          </svg>
        </RouterLink>
      </dd>
    </div>
  </dl>
</template>
