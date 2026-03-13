<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import MapMetricCard from "@/components/map/map-metric-card.vue";
  import MapToolPanel from "@/components/map/map-tool-panel.vue";
  import type {
    MeasureSelectionImageSubject,
    MeasureSelectionOutputMode,
  } from "@/features/app/measure-selection/measure-selection.types";
  import { formatArea, formatDistance } from "@/features/measure/measure.service";
  import type {
    MeasureAreaShape,
    MeasureMode,
    MeasureState,
  } from "@/features/measure/measure.types";

  interface MeasureToolbarProps {
    readonly imageSubject: MeasureSelectionImageSubject;
    readonly outputMode: MeasureSelectionOutputMode;
    readonly state: MeasureState;
  }

  const props = defineProps<MeasureToolbarProps>();

  const emit = defineEmits<{
    clear: [];
    finish: [];
    "set-area-shape": [shape: MeasureAreaShape];
    "set-image-subject": [subject: MeasureSelectionImageSubject];
    "set-mode": [mode: MeasureMode];
    "set-output-mode": [mode: MeasureSelectionOutputMode];
  }>();

  const helperText = computed(() => {
    if (props.state.mode === "off") {
      return "Choose a spatial tool to start.";
    }

    if (props.state.mode === "distance") {
      return "Click the map to add path vertices. Press Esc to cancel.";
    }

    if (props.outputMode === "image") {
      if (props.state.isSelectionComplete) {
        return "Selection complete. PNG download should begin automatically.";
      }

      if (props.imageSubject === "selection-only") {
        return "Completing the shape exports the selection border only.";
      }

      if (props.state.areaShape === "freeform") {
        return "Click points, then click the first point or press Enter to close.";
      }

      return "Click once to anchor and again to finalize the shape.";
    }

    if (props.state.isSelectionComplete) {
      return "Selection complete. Review the analysis panel or press Esc to clear.";
    }

    if (props.state.areaShape === "freeform") {
      return "Click points, then click the first point or press Enter to close.";
    }

    return "Click once to anchor and again to finalize the shape.";
  });

  const panelStatus = computed(() => {
    if (props.state.mode === "off") {
      return "Idle";
    }

    if (props.state.isSelectionComplete) {
      return "Selection complete";
    }

    if (props.state.mode === "distance") {
      return "Measuring distance";
    }

    return "Drawing area";
  });

  function setMode(mode: MeasureMode): void {
    emit("set-mode", mode);
  }

  function activateAreaShape(shape: MeasureAreaShape): void {
    emit("set-mode", "area");
    emit("set-area-shape", shape);
  }

  function setOutputMode(mode: MeasureSelectionOutputMode): void {
    emit("set-output-mode", mode);
  }

  function setImageSubject(subject: MeasureSelectionImageSubject): void {
    emit("set-image-subject", subject);
  }

  function clearMeasure(): void {
    emit("clear");
  }

  function finishSelection(): void {
    emit("finish");
  }
</script>

<template>
  <MapToolPanel aria-label="Measurement tools">
    <template #header>
      <div>
        <h2 class="m-0 text-sm font-semibold">Spatial Analysis</h2>
        <p class="m-0 text-xs text-muted-foreground">{{ helperText }}</p>
      </div>
      <span
        class="map-glass-subtle inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground"
      >
        {{ panelStatus }}
      </span>
    </template>

    <section>
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
      <div class="map-glass-surface inline-flex rounded-lg p-1">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="props.outputMode === 'analysis'
            ? 'map-glass-button-active text-foreground'
            : 'map-glass-button text-muted-foreground hover:text-foreground'"
          @click="setOutputMode('analysis')"
        >
          Analyze
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="props.outputMode === 'image'
            ? 'map-glass-button-active text-foreground'
            : 'map-glass-button text-muted-foreground hover:text-foreground'"
          @click="setOutputMode('image')"
        >
          PNG
        </button>
      </div>
    </section>

    <section v-if="props.outputMode === 'image'">
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        PNG Framing
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          :variant="props.imageSubject === 'selection-with-area' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="setImageSubject('selection-with-area')"
        >
          Selection + area
        </Button>
        <Button
          size="sm"
          :variant="props.imageSubject === 'selection-only' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="setImageSubject('selection-only')"
        >
          Selection only
        </Button>
      </div>
    </section>

    <section>
      <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tools</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          :variant="props.state.mode === 'off' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="setMode('off')"
        >
          Off
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'distance' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="setMode('distance')"
        >
          Distance
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'freeform' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="activateAreaShape('freeform')"
        >
          Polygon
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'rectangle' ? 'glass-active' : 'glass'"
          class="justify-start"
          @click="activateAreaShape('rectangle')"
        >
          Rectangle
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'circle' ? 'glass-active' : 'glass'"
          class="justify-start sm:col-span-2"
          @click="activateAreaShape('circle')"
        >
          Circle
        </Button>
      </div>
    </section>

    <section class="grid gap-2 sm:grid-cols-2" role="region" aria-label="Measurement readings">
      <MapMetricCard label="Mode" :value="props.state.mode" />
      <MapMetricCard
        label="Area Shape"
        :value="props.state.mode === 'area' ? props.state.areaShape : 'n/a'"
      />
      <MapMetricCard label="Distance" :value="formatDistance(props.state.distanceKm)" />
      <MapMetricCard label="Area" :value="formatArea(props.state.areaSqKm)" />
      <MapMetricCard
        label="Selection"
        :value="props.state.isSelectionComplete ? 'Complete' : 'In progress'"
      />
      <MapMetricCard label="Vertices" :value="props.state.vertexCount" />
    </section>

    <template #footer>
      <Button
        size="sm"
        variant="glass-active"
        class="flex-1"
        :disabled="props.state.mode !== 'area' || !props.state.canFinishSelection"
        @click="finishSelection"
      >
        Finish selection
      </Button>
      <Button size="sm" variant="glass" @click="clearMeasure">Clear</Button>
    </template>
  </MapToolPanel>
</template>
