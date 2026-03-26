<script setup lang="ts">
  import { computed, shallowRef, watch } from "vue";
  import PipelineDashboard from "@/features/pipeline/components/pipeline-dashboard.vue";
  import type { PipelineDataset } from "@/features/pipeline/pipeline.types";
  import {
    getPipelineDataset,
    isKnownPipelineDataset,
    pipelineDatasets,
  } from "@/features/pipeline/pipeline-registry.service";

  const PIPELINE_DATASET_SEARCH_PARAM = "dataset";

  function resolveInitialDataset(): PipelineDataset {
    if (typeof window === "undefined") {
      return "parcels";
    }

    const currentUrl = new URL(window.location.href);
    const dataset = currentUrl.searchParams.get(PIPELINE_DATASET_SEARCH_PARAM);

    return isKnownPipelineDataset(dataset) ? dataset : "parcels";
  }

  const dataset = shallowRef<PipelineDataset>(resolveInitialDataset());
  const datasetDefinition = computed(() => getPipelineDataset(dataset.value));

  const title = computed(() => `${datasetDefinition.value.displayName} Pipeline Monitor`);
  const description = computed(
    () =>
      `${datasetDefinition.value.description} Shared manifest-runner step status for the current dataset.`
  );

  function setDataset(nextDataset: PipelineDataset): void {
    dataset.value = nextDataset;
  }

  watch(
    dataset,
    (nextDataset) => {
      if (typeof window === "undefined") {
        return;
      }

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set(PIPELINE_DATASET_SEARCH_PARAM, nextDataset);
      window.history.replaceState({}, "", nextUrl);
    },
    { immediate: true }
  );

  watch(
    title,
    (nextTitle) => {
      if (typeof document === "undefined") {
        return;
      }

      document.title = nextTitle;
    },
    { immediate: true }
  );
</script>

<template>
  <main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
    <header class="mb-5 flex flex-col gap-4">
      <div>
        <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
      </div>

      <div
        class="inline-flex w-fit items-center rounded-xl border border-border/80 bg-card/95 p-1 shadow-sm"
      >
        <button
          v-for="entry in pipelineDatasets"
          :key="entry.dataset"
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-semibold transition"
          :class="
            dataset === entry.dataset
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          "
          @click="setDataset(entry.dataset)"
        >
          {{ entry.displayName }}
        </button>
      </div>
    </header>

    <PipelineDashboard :dataset="dataset" />
  </main>
</template>
