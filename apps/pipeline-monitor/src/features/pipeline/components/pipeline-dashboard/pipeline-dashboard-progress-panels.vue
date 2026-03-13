<script setup lang="ts">
  import { computed } from "vue";
  import type { PipelineDashboardProgressProps } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard.types";
  import {
    formatBuildRate,
    formatBytes,
    formatEta,
  } from "@/features/pipeline/components/pipeline-dashboard/pipeline-dashboard-format.service";
  import { formatCount } from "@/features/pipeline/pipeline.service";
  import { getPipelineDataset } from "@/features/pipeline/pipeline-registry.service";

  const BUILD_EXPORT_ELAPSED_PATTERN = /phase=export\s+([0-9]+)s\b/;

  const props = defineProps<PipelineDashboardProgressProps>();
  const isEnvironmentalDataset = computed(
    () => getPipelineDataset(props.dataset).family === "environmental"
  );

  const buildStageLabel = computed(() => {
    const summary = props.run?.summary ?? "";
    if (
      isEnvironmentalDataset.value &&
      summary.includes("phase=export") &&
      (props.buildProgress?.workDone ?? 0) === 0 &&
      (props.buildProgress?.logBytes ?? 0) === 0
    ) {
      return "Prepare Reduced Overlay Geometry";
    }

    if (summary.includes("phase=reduced-export")) {
      return "Export Reduced Overlay";
    }

    if (summary.includes("phase=export")) {
      return "Export Source Features";
    }

    if (summary.includes("phase=read")) {
      return "Read Features";
    }

    if (summary.includes("phase=reorder")) {
      return "Reorder Geometry";
    }

    if (summary.includes("phase=write")) {
      return "Write Tiles";
    }

    if (props.buildProgress?.stage === "read") {
      return "Read Features";
    }

    if (props.buildProgress?.stage === "write") {
      return "Write Tiles";
    }

    if (props.buildProgress?.stage === "convert") {
      return "Convert MBTiles -> PMTiles";
    }

    return "Finalize Build";
  });

  const buildExportElapsedLabel = computed(() => {
    const summary = props.run?.summary ?? "";
    const match = BUILD_EXPORT_ELAPSED_PATTERN.exec(summary);
    if (match === null) {
      return null;
    }

    return `${match[1]}s elapsed`;
  });

  const isPreparingReducedOverlay = computed(() => {
    const summary = props.run?.summary ?? "";
    return (
      isEnvironmentalDataset.value &&
      summary.includes("phase=export") &&
      (props.buildProgress?.workDone ?? 0) === 0 &&
      (props.buildProgress?.logBytes ?? 0) === 0
    );
  });

  const buildPercentLabel = computed(() => {
    if (isPreparingReducedOverlay.value) {
      return "preparing";
    }

    const buildPercent = props.buildProgress?.percent ?? null;
    if (buildPercent === null) {
      return "n/a";
    }

    return `${buildPercent.toFixed(2)}%`;
  });

  const buildRateLabel = computed(() => {
    if (isPreparingReducedOverlay.value) {
      return "waiting for first export batch";
    }

    return formatBuildRate(
      props.buildRateEstimate.percentPerSecond,
      props.buildRateEstimate.rateBasis
    );
  });
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">State Completion</h2>
        <span class="text-xs font-mono text-muted-foreground">
          {{ props.displayedStatesCompleted }}/{{ props.displayedStatesTotal }}
          ({{ props.stateProgressPercent }}%)
        </span>
      </header>
      <div class="h-2 overflow-hidden rounded bg-muted">
        <div
          class="h-full bg-primary transition-[width] duration-300"
          :style="{ width: `${String(props.stateProgressPercent)}%` }"
        />
      </div>
      <p class="mt-2 text-xs text-muted-foreground">
        Active moving states: {{ props.activeMovingStateCodes.length }}
        <span v-if="props.activeMovingStateCodes.length > 0" class="font-mono">
          ({{ props.activeMovingStateCodes.join(", ") }})
        </span>
      </p>
    </article>

    <article class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm">
      <header class="mb-2 flex items-center justify-between">
        <h2 class="m-0 text-sm font-semibold">Row Completion</h2>
        <span class="text-xs font-mono text-muted-foreground">
          {{ formatCount(props.displayedWrittenCount) }}
          /
          {{ props.displayedExpectedCount === null ? "n/a" : formatCount(props.displayedExpectedCount) }}
          ({{ props.rowProgressPercent }}%)
        </span>
      </header>
      <div class="h-2 overflow-hidden rounded bg-muted">
        <div
          class="h-full bg-emerald-500 transition-[width] duration-300"
          :style="{ width: `${String(props.rowProgressPercent)}%` }"
        />
      </div>
    </article>
  </div>

  <article
    v-if="props.run?.phase === 'building'"
    class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm"
  >
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-sm font-semibold">Planetiler Build Progress</h2>
      <span class="text-xs font-mono text-muted-foreground"> {{ buildPercentLabel }} </span>
    </header>
    <p class="text-xs">
      Step:
      <span class="font-mono">{{ props.run?.summary ?? "tiles:building" }}</span>
    </p>
    <p class="mt-1 text-xs">
      Build log size:
      <span class="font-mono">{{ formatBytes(props.buildProgress?.logBytes ?? null) }}</span>
    </p>
    <p v-if="isPreparingReducedOverlay && buildExportElapsedLabel !== null" class="mt-1 text-xs">
      Elapsed:
      <span class="font-mono">{{ buildExportElapsedLabel }}</span>
    </p>
    <p v-if="props.buildProgress?.stage !== null" class="mt-1 text-xs">
      Build stage:
      <span class="font-mono">{{ buildStageLabel }}</span>
    </p>
    <p v-if="isPreparingReducedOverlay" class="mt-1 text-xs text-muted-foreground">
      Building the environmental overlay geometry in PostGIS before export begins.
    </p>
    <p v-if="props.buildProgress?.workDone !== null" class="mt-1 text-xs">
      {{ props.buildProgress?.workTotal === null ? "Exported rows:" : "Tile work:" }}
      <span class="font-mono">
        {{ formatCount(props.buildProgress?.workDone ?? 0) }}
        <template v-if="props.buildProgress?.workTotal !== null">
          /{{ formatCount(props.buildProgress?.workTotal ?? 0) }}
        </template>
      </span>
    </p>
    <p
      v-if="!isPreparingReducedOverlay && props.buildProgress?.workLeft !== null"
      class="mt-1 text-xs"
    >
      Work left:
      <span class="font-mono">{{ formatCount(props.buildProgress?.workLeft ?? 0) }}</span>
    </p>
    <p class="mt-1 text-xs">
      Build ETA:
      <span class="font-mono">
        {{ isPreparingReducedOverlay ? "estimating after first export batch" : formatEta(props.buildRateEstimate.etaMs) }}
      </span>
    </p>
    <p class="mt-1 text-xs text-muted-foreground">
      build rate:
      <span class="font-mono">{{ buildRateLabel }}</span>
    </p>
    <p v-if="isPreparingReducedOverlay" class="mt-1 text-xs text-amber-700">
      Progress becomes measurable after the first reduced overlay rows are emitted.
    </p>
    <p v-else-if="props.isBuildLikelyStalled" class="mt-1 text-xs text-amber-700">
      No tile-build movement detected recently; ETA uses average build rate.
    </p>
    <div class="mt-3 h-2 overflow-hidden rounded bg-muted">
      <div
        class="h-full bg-indigo-500 transition-[width] duration-300"
        :style="{ width: `${String(props.buildProgressPercent)}%` }"
      />
    </div>
  </article>

  <article
    v-if="props.run?.phase === 'publishing'"
    class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm"
  >
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-sm font-semibold">Publish Progress</h2>
      <span class="text-xs font-mono text-muted-foreground">running</span>
    </header>
    <p class="text-xs">
      Step:
      <span class="font-mono">{{ props.run?.summary ?? "Publishing PMTiles manifest" }}</span>
    </p>
    <p class="mt-1 text-xs text-muted-foreground">
      Copying PMTiles and updating <span class="font-mono">latest.json</span>.
    </p>
  </article>

  <article
    v-if="props.run?.phase === 'loading'"
    class="rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm"
  >
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-sm font-semibold">DB Load Progress</h2>
      <span class="text-xs font-mono text-muted-foreground">{{ props.dbLoadPercentLabel }}</span>
    </header>
    <p class="text-xs">
      Step:
      <span class="font-mono"
        >{{ props.dbLoadProgress?.stepLabel ?? "Loading canonical dataset" }}</span
      >
    </p>
    <p
      v-if="props.dbLoadProgress?.loadedFiles != null && props.dbLoadProgress?.totalFiles != null"
      class="mt-1 text-xs"
    >
      Files:
      <span class="font-mono">
        {{ formatCount(props.dbLoadProgress?.loadedFiles ?? 0) }}/{{ formatCount(props.dbLoadProgress?.totalFiles ?? 0) }}
      </span>
    </p>
    <p v-if="props.dbLoadProgress?.currentFile != null" class="mt-1 break-words text-xs">
      {{ props.dbLoadDetailLabel }}:
      <span class="font-mono">{{ props.dbLoadProgress?.currentFile }}</span>
    </p>
    <p
      v-if="props.dbLoadProgress?.completedStates != null && props.dbLoadProgress?.totalStates != null"
      class="mt-1 text-xs"
    >
      States:
      <span class="font-mono">
        {{ formatCount(props.dbLoadProgress?.completedStates ?? 0) }}/{{ formatCount(props.dbLoadProgress?.totalStates ?? 0) }}
      </span>
    </p>
    <p v-if="(props.dbLoadProgress?.activeWorkers.length ?? 0) > 0" class="mt-1 text-xs">
      Active workers:
      <span class="font-mono">{{ props.dbLoadProgress?.activeWorkers.join(", ") }}</span>
    </p>
    <p v-if="props.isMaterializeFinalizing" class="mt-1 text-xs text-muted-foreground">
      Finalizing large transaction. Progress can stay at 99% until commit completes.
    </p>
    <div class="mt-3 h-2 overflow-hidden rounded bg-muted">
      <div
        class="h-full bg-sky-500 transition-[width] duration-300"
        :style="{ width: `${String(props.dbLoadProgress?.percent ?? 0)}%` }"
      />
    </div>
  </article>
</template>
