<script setup lang="ts">
  import { computed } from "vue";
  import { formatCount } from "../../pipeline.service";
  import type { PipelineDashboardProgressProps } from "./pipeline-dashboard.types";
  import { formatBuildRate, formatBytes, formatEta } from "./pipeline-dashboard-format.service";

  const props = defineProps<PipelineDashboardProgressProps>();

  const buildStageLabel = computed(() => {
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
      <h2 class="m-0 text-sm font-semibold">Tile Build Progress</h2>
      <span class="text-xs font-mono text-muted-foreground">
        {{ props.buildProgress?.percent === null ? "n/a" : `${(props.buildProgress?.percent ?? 0).toFixed(2)}%` }}
      </span>
    </header>
    <p class="text-xs">
      Step:
      <span class="font-mono">{{ props.run?.summary ?? "tiles:building" }}</span>
    </p>
    <p class="mt-1 text-xs">
      Build log size:
      <span class="font-mono">{{ formatBytes(props.buildProgress?.logBytes ?? null) }}</span>
    </p>
    <p v-if="props.buildProgress?.stage !== null" class="mt-1 text-xs">
      Build stage:
      <span class="font-mono">{{ buildStageLabel }}</span>
    </p>
    <p
      v-if="props.buildProgress?.workDone !== null && props.buildProgress?.workTotal !== null"
      class="mt-1 text-xs"
    >
      Tile work:
      <span class="font-mono">
        {{ formatCount(props.buildProgress?.workDone ?? 0) }}/{{ formatCount(props.buildProgress?.workTotal ?? 0) }}
      </span>
    </p>
    <p v-if="props.buildProgress?.workLeft !== null" class="mt-1 text-xs">
      Work left:
      <span class="font-mono">{{ formatCount(props.buildProgress?.workLeft ?? 0) }}</span>
    </p>
    <p class="mt-1 text-xs">
      Build ETA:
      <span class="font-mono">{{ formatEta(props.buildRateEstimate.etaMs) }}</span>
    </p>
    <p class="mt-1 text-xs text-muted-foreground">
      build rate:
      <span class="font-mono">
        {{ formatBuildRate(props.buildRateEstimate.percentPerSecond, props.buildRateEstimate.rateBasis) }}
      </span>
    </p>
    <p v-if="props.isBuildLikelyStalled" class="mt-1 text-xs text-amber-700">
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
