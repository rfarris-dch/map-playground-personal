<script setup lang="ts">
  import { computed, useTemplateRef } from "vue";
  import { useProseMermaid } from "@/features/docs/composables/use-prose-mermaid";

  const props = defineProps<{
    html: string;
  }>();

  const proseRef = useTemplateRef<HTMLDivElement>("proseRoot");
  const htmlContent = computed(() => props.html);

  useProseMermaid(proseRef, htmlContent);
</script>

<template>
  <!-- Content is loaded from trusted, repository-authored markdown files. -->
  <div
    ref="proseRoot"
    class="prose max-w-none prose-slate dark:text-slate-400 dark:prose-invert prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-34 prose-lead:text-slate-500 dark:prose-lead:text-slate-400 prose-a:font-semibold dark:prose-a:text-sky-400 dark:[--tw-prose-background:var(--color-slate-900)] prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,var(--color-sky-300))] prose-a:hover:[--tw-prose-underline-size:6px] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,var(--color-sky-800))] dark:prose-a:hover:[--tw-prose-underline-size:6px] prose-pre:rounded-xl prose-pre:bg-slate-900 prose-pre:shadow-lg dark:prose-pre:bg-slate-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-slate-300/10 dark:prose-hr:border-slate-800"
    v-html="htmlContent"
  />
</template>
