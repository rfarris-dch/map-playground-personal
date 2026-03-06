<script setup lang="ts">
  import { BookOpen, Monitor, Package, Pencil, Server, Shield } from "lucide-vue-next";
  import type { Component } from "vue";
  import { computed } from "vue";
  import ProseContent from "@/features/docs/components/prose-content.vue";
  import { docsCollection } from "@/features/docs/docs-content.service";
  import type { DocsNavigationGroup, DocsPage } from "@/features/docs/docs-content.types";

  interface SectionCard {
    readonly description: string;
    readonly pageCount: number;
    readonly slug: string;
    readonly title: string;
  }

  const props = defineProps<{
    page: DocsPage;
  }>();

  const sectionDescriptions: Readonly<Record<string, string>> = {
    "Getting Started":
      "Entry docs for workspace layout, commands, repo guardrails, and the fastest path to productive source reading.",
    Repository:
      "The high-level repo structure, information architecture, and the boundaries that keep apps, packages, scripts, and workflows understandable.",
    Applications:
      "The runtime foundations for apps/web, apps/api, apps/pipeline-monitor, and the docs app itself.",
    Packages:
      "Shared contracts, map runtime packages, query packages, and operations helpers used across the runnable apps.",
    "Data And Sync":
      "Cross-surface documentation for parcel sync, status snapshots, runtime files, and monitor-facing state.",
    Operations:
      "Command-level parcel and tile workflows, troubleshooting guidance, and rollback or monitoring playbooks.",
    References:
      "Source maps and contract-oriented pages that point readers back to authoritative code and transport seams.",
    Contributing:
      "Docs-authoring rules and release verification guidance for keeping the docs surface coherent over time.",
  };

  const featuredPages = computed(() => {
    const featuredSlugs = [
      "/docs/getting-started/workspace-and-commands",
      "/docs/applications/web-runtime",
      "/docs/applications/api-runtime",
      "/docs/packages/core-runtime",
      "/docs/operations/troubleshooting-and-recovery",
      "/docs/contributing/docs-authoring",
    ];

    return featuredSlugs
      .map((slug) => docsCollection.pages.find((page) => page.slug === slug))
      .filter((page): page is DocsPage => typeof page !== "undefined")
      .map((page) => ({
        page,
        icon: resolveFeaturedIcon(page.slug),
      }));
  });

  const sectionCards = computed(() =>
    docsCollection.groups
      .map((group) => createSectionCard(group))
      .filter((card): card is SectionCard => card !== null)
  );

  function createSectionCard(group: DocsNavigationGroup): SectionCard | null {
    const firstPage = group.pages[0];
    if (typeof firstPage === "undefined") {
      return null;
    }

    return {
      title: group.title,
      description: sectionDescriptions[group.title] ?? "Repo-facing docs pages grouped by concern.",
      slug: firstPage.slug,
      pageCount: group.pages.length,
    };
  }

  function resolveFeaturedIcon(slug: string): Component {
    switch (slug) {
      case "/docs/getting-started/workspace-and-commands":
        return BookOpen;
      case "/docs/applications/web-runtime":
        return Monitor;
      case "/docs/applications/api-runtime":
        return Server;
      case "/docs/packages/core-runtime":
        return Package;
      case "/docs/operations/troubleshooting-and-recovery":
        return Shield;
      case "/docs/contributing/docs-authoring":
        return Pencil;
      default:
        return BookOpen;
    }
  }
</script>

<template>
  <div>
    <div class="not-prose my-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <article
        v-for="featuredPage in featuredPages"
        :key="featuredPage.page.slug"
        class="group relative rounded-xl border border-slate-200 dark:border-slate-800"
      >
        <div
          class="absolute -inset-px rounded-xl border-2 border-transparent opacity-0 [background:linear-gradient(var(--quick-links-hover-bg,var(--color-sky-50)),var(--quick-links-hover-bg,var(--color-sky-50)))_padding-box,linear-gradient(to_top,var(--color-indigo-400),var(--color-cyan-400),var(--color-sky-500))_border-box] group-hover:opacity-100 dark:[--quick-links-hover-bg:var(--color-slate-800)]"
        />
        <div class="relative overflow-hidden rounded-xl p-6">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-sky-500/25 to-indigo-500/25 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-200"
          >
            <component :is="featuredPage.icon" class="h-4 w-4" />
          </div>
          <h2 class="mt-4 font-display text-base text-slate-900 dark:text-white">
            <RouterLink :to="featuredPage.page.slug">
              <span class="absolute -inset-px rounded-xl" />
              {{ featuredPage.page.title }}
            </RouterLink>
          </h2>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-400">
            {{ featuredPage.page.description }}
          </p>
        </div>
      </article>
    </div>

    <div class="not-prose my-12">
      <div class="mb-6 flex items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-sky-500 uppercase">Full Corpus</p>
          <h2 class="mt-2 font-display text-2xl tracking-tight text-slate-900 dark:text-white">
            Section by section
          </h2>
        </div>
        <RouterLink
          to="/docs/repository/information-architecture"
          class="text-sm font-semibold text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"
        >
          View IA
        </RouterLink>
      </div>

      <div class="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        <article
          v-for="section in sectionCards"
          :key="section.title"
          class="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm shadow-slate-900/5 dark:border-white/10 dark:bg-slate-900/40 dark:shadow-none"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <h3 class="font-display text-lg tracking-tight text-slate-900 dark:text-white">
              {{ section.title }}
            </h3>
            <span
              class="inline-flex shrink-0 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] text-sky-600 uppercase dark:bg-sky-400/10 dark:text-sky-300"
            >
              {{ section.pageCount }}
              pages
            </span>
          </div>
          <p class="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
            {{ section.description }}
          </p>
          <RouterLink
            :to="section.slug"
            class="mt-5 inline-flex text-sm font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-200"
          >
            Open section
          </RouterLink>
        </article>
      </div>
    </div>

    <ProseContent :html="props.page.html" />
  </div>
</template>
