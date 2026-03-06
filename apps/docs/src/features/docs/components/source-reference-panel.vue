<script setup lang="ts">
  import { computed } from "vue";
  import type { DocsPage } from "@/features/docs/docs-content.types";
  import { createDocsSourceReferenceSummary } from "@/features/docs/docs-source-references.service";

  const props = defineProps<{
    page: DocsPage;
  }>();

  const sourceSummary = computed(() => createDocsSourceReferenceSummary(props.page));

  function sourceKindLabel(kind: string): string {
    switch (kind) {
      case "application":
        return "App";
      case "artifact":
        return "Artifact";
      case "docs":
        return "Docs";
      case "package":
        return "Package";
      case "script":
        return "Script";
      default:
        return "Source";
    }
  }
</script>

<template>
  <section
    class="mt-12 rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm shadow-slate-950/5 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none"
    aria-labelledby="source-references-title"
  >
    <div class="flex flex-col gap-2">
      <p class="text-xs font-semibold tracking-[0.2em] text-sky-500 uppercase">Source References</p>
      <h2
        id="source-references-title"
        class="font-display text-2xl tracking-tight text-slate-900 dark:text-white"
      >
        Where this page gets its truth
      </h2>
      <p class="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        The docs app explains behavior. These paths point to the source files or preserved artifacts
        that remain authoritative when exact runtime detail matters.
      </p>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <article
        class="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5"
      >
        <p
          class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400"
        >
          {{ sourceSummary.pageSource.role === "authored-doc"
              ? "Explanatory Page Source"
              : "Rendered Artifact Source" }}
        </p>
        <p class="mt-3 break-all font-mono text-sm text-slate-900 dark:text-slate-100">
          {{ sourceSummary.pageSource.path }}
        </p>
        <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {{ sourceSummary.pageSource.description }}
        </p>
      </article>

      <article
        class="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5"
      >
        <p
          class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400"
        >
          Authoritative Runtime Sources
        </p>
        <p
          v-if="sourceSummary.authoritativeSources.length === 0"
          class="mt-3 text-sm text-slate-600 dark:text-slate-400"
        >
          This page is primarily orientation content. Follow its related docs links for the nearest
          runtime or artifact ownership surfaces.
        </p>
        <ul v-else class="mt-3 space-y-3">
          <li
            v-for="item in sourceSummary.authoritativeSources"
            :key="item.path"
            class="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="inline-flex rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-sky-600 uppercase dark:bg-sky-400/10 dark:text-sky-300"
              >
                {{ sourceKindLabel(item.kind) }}
              </span>
              <RouterLink
                v-if="item.relatedDocs"
                :to="item.relatedDocs.slug"
                class="text-xs font-semibold text-slate-500 transition hover:text-sky-500 dark:text-slate-400 dark:hover:text-sky-300"
              >
                Related docs: {{ item.relatedDocs.title }}
              </RouterLink>
            </div>
            <p class="mt-3 break-all font-mono text-sm text-slate-900 dark:text-slate-100">
              {{ item.path }}
            </p>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">{{ item.description }}</p>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>
