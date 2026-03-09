<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import { formatArea, formatDistance } from "@/features/sketch-measure/sketch-measure.service";
  import type {
    SketchMeasureAreaShape,
    SketchMeasureMode,
    SketchMeasureState,
  } from "@/features/sketch-measure/sketch-measure.types";

  interface SketchMeasureToolbarProps {
    readonly state: SketchMeasureState;
  }

  const props = defineProps<SketchMeasureToolbarProps>();

  const emit = defineEmits<{
    clear: [];
    finish: [];
    "set-area-shape": [shape: SketchMeasureAreaShape];
    "set-mode": [mode: SketchMeasureMode];
    "use-as-selection": [];
  }>();

  const helperText = computed(() => {
    if (props.state.mode === "off") {
      return "Choose a sketch or measure tool to start.";
    }

    if (props.state.mode === "distance") {
      return "Click the map to add path vertices. Press Esc to cancel.";
    }

    if (props.state.isAreaComplete) {
      return "Sketch complete. Use it as a selection or clear to start over.";
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

    if (props.state.mode === "distance") {
      return "Measuring distance";
    }

    if (props.state.isAreaComplete) {
      return "Sketch complete";
    }

    return "Sketching area";
  });

  function setMode(mode: SketchMeasureMode): void {
    emit("set-mode", mode);
  }

  function activateAreaShape(shape: SketchMeasureAreaShape): void {
    emit("set-mode", "area");
    emit("set-area-shape", shape);
  }

  function clearSketchMeasure(): void {
    emit("clear");
  }

  function finishArea(): void {
    emit("finish");
  }

  function useAsSelection(): void {
    emit("use-as-selection");
  }
</script>

<template>
  <aside
    class="map-glass-panel pointer-events-auto absolute bottom-16 left-4 z-20 w-[min(28rem,calc(100%-2rem))] rounded-xl p-3"
    aria-label="Sketch and measure tools"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="m-0 text-sm font-semibold">Sketch / Measure</h2>
        <p class="m-0 text-[11px] text-muted-foreground">{{ helperText }}</p>
      </div>
      <span
        class="map-glass-pill inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      >
        {{ panelStatus }}
      </span>
    </header>

    <section class="mb-3">
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tools
      </p>
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

    <section class="mb-3 grid gap-2 sm:grid-cols-2">
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Mode</div>
        <div class="text-sm font-medium">{{ props.state.mode }}</div>
      </div>
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Area Shape</div>
        <div class="text-sm font-medium">
          {{ props.state.mode === "area" ? props.state.areaShape : "n/a" }}
        </div>
      </div>
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</div>
        <div class="text-sm font-medium tabular-nums">
          {{ formatDistance(props.state.distanceKm) }}
        </div>
      </div>
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Area</div>
        <div class="text-sm font-medium tabular-nums">{{ formatArea(props.state.areaSqKm) }}</div>
      </div>
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Sketch</div>
        <div class="text-sm font-medium">
          {{ props.state.isAreaComplete ? "Complete" : "In progress" }}
        </div>
      </div>
      <div class="map-glass-card rounded-md px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Vertices</div>
        <div class="text-sm font-medium tabular-nums">{{ props.state.vertexCount }}</div>
      </div>
    </section>

    <footer class="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="glass-active"
        class="flex-1"
        :disabled="props.state.mode !== 'area' || !props.state.canFinishArea"
        @click="finishArea"
      >
        Finish sketch
      </Button>
      <Button
        size="sm"
        variant="glass"
        class="flex-1"
        :disabled="props.state.completedAreaGeometry === null"
        @click="useAsSelection"
      >
        Use Sketch As Selection
      </Button>
      <Button size="sm" variant="glass" @click="clearSketchMeasure">Clear</Button>
    </footer>
  </aside>
</template>
