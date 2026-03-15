<script setup lang="ts">
  import { computed } from "vue";
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
      return "Choose a tool";
    }
    if (props.state.mode === "distance") {
      return "Click to add vertices";
    }
    if (props.state.isAreaComplete) {
      return "Sketch complete";
    }
    if (props.state.areaShape === "freeform") {
      return "Click points, Enter to close";
    }
    return "Click to anchor, click to finalize";
  });

  interface ToolOption {
    action: () => void;
    active: boolean;
    label: string;
  }

  const tools = computed<ToolOption[]>(() => [
    {
      label: "Polygon",
      active: props.state.mode === "area" && props.state.areaShape === "freeform",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "freeform");
      },
    },
    {
      label: "Rectangle",
      active: props.state.mode === "area" && props.state.areaShape === "rectangle",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "rectangle");
      },
    },
    {
      label: "Circle",
      active: props.state.mode === "area" && props.state.areaShape === "circle",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "circle");
      },
    },
    {
      label: "Distance",
      active: props.state.mode === "distance",
      action: () => emit("set-mode", "distance"),
    },
  ]);
</script>

<template>
  <aside
    class="map-glass-elevated pointer-events-auto absolute bottom-10 left-[420px] z-20 flex items-center gap-2 rounded-lg px-3 py-1.5"
    aria-label="Sketch and measure tools"
  >
    <button
      v-for="tool in tools"
      :key="tool.label"
      type="button"
      class="rounded px-2 py-1 text-xs font-medium transition-colors"
      :class="tool.active ? 'map-glass-button-active text-foreground' : 'text-muted-foreground hover:text-foreground/70'"
      @click="tool.action()"
    >
      {{ tool.label }}
    </button>

    <div class="h-4 w-px bg-border" />

    <span class="text-xs tabular-nums text-muted-foreground">
      {{ formatDistance(props.state.distanceKm) }}
      · {{ formatArea(props.state.areaSqKm) }}
    </span>

    <div class="h-4 w-px bg-border" />

    <button
      type="button"
      class="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted disabled:text-muted-foreground/40"
      :disabled="props.state.mode !== 'area' || !props.state.canFinishArea"
      @click="emit('finish')"
    >
      Finish
    </button>
    <button
      type="button"
      class="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-muted disabled:text-muted-foreground/40"
      :disabled="props.state.completedAreaGeometry === null"
      @click="emit('use-as-selection')"
    >
      Use as Selection
    </button>
    <button
      type="button"
      class="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground/70"
      @click="emit('clear')"
    >
      Clear
    </button>

    <span class="text-xs text-muted-foreground">{{ helperText }}</span>
  </aside>
</template>
