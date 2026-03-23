<script setup lang="ts">
  import {
    Check,
    CircleDot,
    MousePointerClick,
    Pentagon,
    Ruler,
    Square,
    Trash2,
  } from "lucide-vue-next";
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

  interface ToolOption {
    action: () => void;
    active: boolean;
    icon: typeof Pentagon;
    label: string;
  }

  const tools = computed<ToolOption[]>(() => [
    {
      label: "Polygon",
      icon: Pentagon,
      active: props.state.mode === "area" && props.state.areaShape === "freeform",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "freeform");
      },
    },
    {
      label: "Rectangle",
      icon: Square,
      active: props.state.mode === "area" && props.state.areaShape === "rectangle",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "rectangle");
      },
    },
    {
      label: "Circle",
      icon: CircleDot,
      active: props.state.mode === "area" && props.state.areaShape === "circle",
      action: () => {
        emit("set-mode", "area");
        emit("set-area-shape", "circle");
      },
    },
    {
      label: "Distance",
      icon: Ruler,
      active: props.state.mode === "distance",
      action: () => emit("set-mode", "distance"),
    },
  ]);

  const hasActiveTool = computed(() => props.state.mode !== "off");

  const hasDistance = computed(() => props.state.distanceKm !== null && props.state.distanceKm > 0);
  const hasArea = computed(() => props.state.areaSqKm !== null && props.state.areaSqKm > 0);
  const hasMetrics = computed(() => hasDistance.value || hasArea.value);
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-8 left-1/2 z-20 -translate-x-1/2"
    aria-label="Sketch and measure tools"
  >
    <div
      class="map-glass-elevated flex items-center gap-1 whitespace-nowrap rounded-xl px-1.5 py-1.5"
    >
      <!-- Tool buttons -->
      <div class="flex items-center gap-px rounded-lg bg-black/[0.03] p-px">
        <button
          v-for="tool in tools"
          :key="tool.label"
          type="button"
          class="flex items-center gap-1 rounded-[7px] border border-transparent px-2 py-1 text-[11px] font-medium transition-all duration-150"
          :class="
            tool.active
              ? 'map-glass-button-active !border-blue-200/80 text-blue-700'
              : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
          "
          @click="tool.action()"
        >
          <component :is="tool.icon" :size="12" :stroke-width="tool.active ? 2.25 : 1.75" />
          <span>{{ tool.label }}</span>
        </button>
      </div>

      <!-- Divider -->
      <div v-if="hasMetrics" class="mx-0.5 h-5 w-px bg-white/40" />

      <!-- Metrics -->
      <div v-if="hasMetrics" class="flex items-center gap-2 px-1.5">
        <div v-if="hasDistance" class="flex items-baseline gap-1">
          <span class="text-[9px] font-semibold uppercase tracking-widest text-slate-400"
            >Dist</span
          >
          <span class="text-[11px] font-semibold tabular-nums text-slate-700">
            {{ formatDistance(props.state.distanceKm) }}
          </span>
        </div>
        <div v-if="hasDistance && hasArea" class="h-3 w-px bg-slate-200/60" />
        <div v-if="hasArea" class="flex items-baseline gap-1">
          <span class="text-[9px] font-semibold uppercase tracking-widest text-slate-400"
            >Area</span
          >
          <span class="text-[11px] font-semibold tabular-nums text-slate-700">
            {{ formatArea(props.state.areaSqKm) }}
          </span>
        </div>
      </div>

      <!-- Divider -->
      <div v-if="hasActiveTool" class="mx-0.5 h-5 w-px bg-white/40" />

      <!-- Actions -->
      <div v-if="hasActiveTool" class="flex items-center gap-0.5">
        <button
          type="button"
          class="map-glass-button flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-35"
          :disabled="props.state.mode !== 'area' || !props.state.canFinishArea"
          @click="emit('finish')"
        >
          <Check :size="12" :stroke-width="2.25" />
          Finish
        </button>
        <button
          type="button"
          class="map-glass-button-active flex items-center gap-1 rounded-lg border border-blue-200/80 px-2 py-1 text-[11px] font-medium text-blue-700 disabled:pointer-events-none disabled:border-transparent disabled:bg-slate-100/50 disabled:text-slate-400 disabled:shadow-none"
          :disabled="props.state.draftAreaGeometry === null"
          @click="emit('use-as-selection')"
        >
          <MousePointerClick :size="12" :stroke-width="2" />
          Select Area
        </button>
        <button
          type="button"
          class="map-glass-button flex items-center justify-center rounded-lg p-1 text-slate-400 transition hover:text-red-500"
          @click="emit('clear')"
          title="Clear"
        >
          <Trash2 :size="12" :stroke-width="1.75" />
        </button>
      </div>
    </div>
  </aside>
</template>
