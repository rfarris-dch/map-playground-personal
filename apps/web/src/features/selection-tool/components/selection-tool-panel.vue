<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import { formatArea } from "@/features/measure/measure.service";
  import type { MeasureState } from "@/features/measure/measure.types";
  import type { SelectionToolSummary } from "@/features/selection-tool/selection-tool.types";

  interface SelectionToolPanelProps {
    readonly hasCompletedDraftSelection: boolean;
    readonly isLoading: boolean;
    readonly isPanelOpen: boolean;
    readonly isSelectionStale: boolean;
    readonly measureState: MeasureState;
    readonly selectionSummary: SelectionToolSummary | null;
  }

  const props = defineProps<SelectionToolPanelProps>();

  const emit = defineEmits<{
    "analyze-current-selection": [];
    "clear-draft": [];
    dismiss: [];
    "set-area-shape": [shape: "freeform" | "rectangle"];
  }>();

  const helperText = computed(() => {
    if (!props.hasCompletedDraftSelection) {
      return "Choose lasso or rectangle, then finish the shape to prepare a selection.";
    }

    if (props.isLoading) {
      return "Refreshing facilities, markets, and parcels for the analyzed selection.";
    }

    if (props.isSelectionStale) {
      return "The current shape changed. Analyze Current Selection to refresh the summary.";
    }

    return "Selection results are current and can be exported or reopened without drawing again.";
  });

  const panelStatus = computed(() => {
    if (!props.hasCompletedDraftSelection) {
      return "Drafting";
    }

    if (props.isLoading) {
      return "Analyzing";
    }

    if (props.isSelectionStale) {
      return "Needs refresh";
    }

    return "Up to date";
  });

  const canAnalyze = computed(() => props.hasCompletedDraftSelection && !props.isLoading);

  const selectionMetrics = computed(() => ({
    areaText: formatArea(props.measureState.areaSqKm),
    marketCount: props.selectionSummary?.summary.marketSelection?.matchCount ?? 0,
    parcelCount: props.selectionSummary?.summary.parcelSelection.count ?? 0,
    facilityCount: props.selectionSummary?.summary.totalCount ?? 0,
  }));
</script>

<template>
  <aside
    v-if="props.isPanelOpen"
    class="map-glass-elevated pointer-events-auto absolute bottom-16 left-4 z-20 w-[min(28rem,calc(100%-2rem))] rounded-xl p-3"
    aria-label="Selection tools"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="m-0 text-sm font-semibold">Selection Tool</h2>
        <p class="m-0 text-xs text-muted-foreground">{{ helperText }}</p>
      </div>
      <span
        class="map-glass-subtle inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground"
      >
        {{ panelStatus }}
      </span>
    </header>

    <section class="mb-3">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Entry Actions
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          :variant="props.measureState.mode === 'area' && props.measureState.areaShape === 'freeform' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="emit('set-area-shape', 'freeform')"
        >
          Select By Lasso
        </Button>
        <Button
          size="sm"
          :variant="props.measureState.mode === 'area' && props.measureState.areaShape === 'rectangle' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="emit('set-area-shape', 'rectangle')"
        >
          Select By Rectangle
        </Button>
      </div>
    </section>

    <section class="mb-3">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Current Shape
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Shape</div>
          <div class="text-sm font-medium">
            {{ props.measureState.mode === "area" ? props.measureState.areaShape : "none" }}
          </div>
        </div>
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
          <div class="text-sm font-medium">
            {{ props.hasCompletedDraftSelection ? "Ready" : "In progress" }}
          </div>
        </div>
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Area</div>
          <div class="text-sm font-medium tabular-nums">{{ selectionMetrics.areaText }}</div>
        </div>
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Vertices</div>
          <div class="text-sm font-medium tabular-nums">{{ props.measureState.vertexCount }}</div>
        </div>
      </div>
    </section>

    <section class="mb-3">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Last Result
      </p>
      <div class="grid gap-2 sm:grid-cols-3">
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Facilities</div>
          <div class="text-sm font-medium tabular-nums">{{ selectionMetrics.facilityCount }}</div>
        </div>
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Markets</div>
          <div class="text-sm font-medium tabular-nums">{{ selectionMetrics.marketCount }}</div>
        </div>
        <div class="map-glass-surface rounded-md px-3 py-2">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Parcels</div>
          <div class="text-sm font-medium tabular-nums">{{ selectionMetrics.parcelCount }}</div>
        </div>
      </div>
    </section>

    <footer class="flex flex-wrap items-center gap-2">
      <Button
        variant="glass-active"
        class="flex-1"
        :disabled="!canAnalyze"
        @click="emit('analyze-current-selection')"
      >
        Analyze Current Selection
      </Button>
      <Button variant="glass" @click="emit('clear-draft')">Clear Draft</Button>
      <Button variant="glass" @click="emit('dismiss')">Close</Button>
    </footer>
  </aside>
</template>
