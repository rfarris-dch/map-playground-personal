<script setup lang="ts">
  import DocsHeader from "@/features/docs/components/docs-header.vue";
  import HomeBody from "@/features/docs/components/home-body.vue";
  import PrevNextLinks from "@/features/docs/components/prev-next-links.vue";
  import ProseContent from "@/features/docs/components/prose-content.vue";
  import ReleaseVerificationPanel from "@/features/docs/components/release-verification-panel.vue";
  import SourceReferencePanel from "@/features/docs/components/source-reference-panel.vue";
  import TableOfContents from "@/features/docs/components/table-of-contents.vue";
  import { useDocsContent } from "@/features/docs/composables/use-docs-content";

  const { currentPage, prevNext } = useDocsContent();
</script>

<template>
  <template v-if="currentPage">
    <div class="max-w-2xl min-w-0 flex-auto px-4 py-16 lg:max-w-none lg:pr-0 lg:pl-8 xl:px-16">
      <article>
        <DocsHeader
          :section-title="currentPage.sectionTitle"
          :title="currentPage.title"
          :description="currentPage.description"
        />
        <HomeBody v-if="currentPage.slug === '/'" :page="currentPage" />
        <ProseContent v-else :html="currentPage.html" />
        <SourceReferencePanel v-if="currentPage.slug !== '/'" :page="currentPage" />
        <ReleaseVerificationPanel
          v-if="currentPage.slug === '/docs/contributing/release-checklist'"
        />
      </article>
      <PrevNextLinks :previous="prevNext.previous" :next="prevNext.next" />
    </div>
    <TableOfContents :sections="currentPage.tocSections" />
  </template>

  <div v-else class="mx-auto max-w-3xl px-4 py-24">
    <h1 class="font-display text-4xl tracking-tight text-slate-900 dark:text-white">
      Page not found
    </h1>
    <p class="mt-4 text-slate-600 dark:text-slate-400">
      The requested docs page does not exist in the current content registry.
    </p>
    <RouterLink
      to="/"
      class="mt-8 inline-flex items-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white"
    >
      Return to docs home
    </RouterLink>
  </div>
</template>
