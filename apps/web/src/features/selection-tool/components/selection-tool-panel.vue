<script setup lang="ts">
  import { computed } from "vue";
  import MapMetricCard from "@/components/map/map-metric-card.vue";
  import MapToolPanel from "@/components/map/map-tool-panel.vue";
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
  <MapToolPanel v-if="props.isPanelOpen" aria-label="Selection tools">
    <template #header>
      <div>
        <h2 class="m-0 text-sm font-semibold">Selection Tool</h2>
        <p class="m-0 text-xs text-muted-foreground">{{ helperText }}</p>
      </div>
      <span
        class="map-glass-subtle inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground"
      >
        {{ panelStatus }}
      </span>
    </template>

    <section>
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

    <section>
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Current Shape
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <MapMetricCard
          label="Shape"
          :value="props.measureState.mode === 'area' ? props.measureState.areaShape : 'none'"
        />
        <MapMetricCard
          label="Status"
          :value="props.hasCompletedDraftSelection ? 'Ready' : 'In progress'"
        />
        <MapMetricCard label="Area" :value="selectionMetrics.areaText" />
        <MapMetricCard label="Vertices" :value="props.measureState.vertexCount" />
      </div>
    </section>

    <section>
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Last Result
      </p>
      <div class="grid gap-2 sm:grid-cols-3">
        <MapMetricCard label="Facilities" :value="selectionMetrics.facilityCount" />
        <MapMetricCard label="Markets" :value="selectionMetrics.marketCount" />
        <MapMetricCard label="Parcels" :value="selectionMetrics.parcelCount" />
      </div>
    </section>

    <template #footer>
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
    </template>
  </MapToolPanel>
</template>
