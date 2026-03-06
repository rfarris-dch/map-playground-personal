<script setup lang="ts">
  import { computed } from "vue";
  import ProseContent from "@/features/docs/components/prose-content.vue";
  import { docsCollection } from "@/features/docs/docs-content.service";
  import type { DocsPage } from "@/features/docs/docs-content.types";

  const props = defineProps<{
    page: DocsPage;
  }>();

  const featuredPages = computed(() => {
    const featuredSlugs = [
      "/docs/getting-started/workspace-and-commands",
      "/docs/applications/web-runtime",
      "/docs/applications/api-runtime",
      "/docs/packages/core-runtime",
      "/docs/operations/runbooks-and-troubleshooting",
      "/docs/contributing/docs-authoring",
    ];

    return featuredSlugs
      .map((slug) => docsCollection.pages.find((page) => page.slug === slug))
      .filter((page): page is DocsPage => typeof page !== "undefined");
  });
</script>

<template>
  <div>
    <div class="not-prose my-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <article
        v-for="featuredPage in featuredPages"
        :key="featuredPage.slug"
        class="group relative rounded-xl border border-slate-200 dark:border-slate-800"
      >
        <div
          class="absolute -inset-px rounded-xl border-2 border-transparent opacity-0 [background:linear-gradient(var(--quick-links-hover-bg,var(--color-sky-50)),var(--quick-links-hover-bg,var(--color-sky-50)))_padding-box,linear-gradient(to_top,var(--color-indigo-400),var(--color-cyan-400),var(--color-sky-500))_border-box] group-hover:opacity-100 dark:[--quick-links-hover-bg:var(--color-slate-800)]"
        />
        <div class="relative overflow-hidden rounded-xl p-6">
          <div
            class="h-8 w-8 rounded-lg bg-linear-to-br from-sky-500/25 to-indigo-500/25 ring-1 ring-sky-500/25"
          />
          <h2 class="mt-4 font-display text-base text-slate-900 dark:text-white">
            <RouterLink :to="featuredPage.slug">
              <span class="absolute -inset-px rounded-xl" />
              {{ featuredPage.title }}
            </RouterLink>
          </h2>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-400">
            {{ featuredPage.description }}
          </p>
        </div>
      </article>
    </div>

    <ProseContent :html="props.page.html" />
  </div>
</template>
