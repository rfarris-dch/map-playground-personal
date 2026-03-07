<script setup lang="ts">
  import { computed } from "vue";
  import Button from "@/components/ui/button/button.vue";
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
  <aside
    class="pointer-events-auto absolute bottom-16 left-4 z-20 w-[min(28rem,calc(100%-2rem))] rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-sm"
    aria-label="Measurement tools"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 class="m-0 text-sm font-semibold">Spatial Analysis</h2>
        <p class="m-0 text-[11px] text-muted-foreground">{{ helperText }}</p>
      </div>
      <span
        class="inline-flex items-center rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
      >
        {{ panelStatus }}
      </span>
    </header>

    <section class="mb-3">
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Output
      </p>
      <div class="inline-flex rounded-lg border border-border/60 bg-muted/20 p-1">
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="props.outputMode === 'analysis'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'"
          @click="setOutputMode('analysis')"
        >
          Analyze
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1 text-xs font-medium transition"
          :class="props.outputMode === 'image'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'"
          @click="setOutputMode('image')"
        >
          PNG
        </button>
      </div>
    </section>

    <section v-if="props.outputMode === 'image'" class="mb-3">
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        PNG Framing
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          :variant="props.imageSubject === 'selection-with-area' ? 'default' : 'outline'"
          class="justify-start"
          @click="setImageSubject('selection-with-area')"
        >
          Selection + area
        </Button>
        <Button
          size="sm"
          :variant="props.imageSubject === 'selection-only' ? 'default' : 'outline'"
          class="justify-start"
          @click="setImageSubject('selection-only')"
        >
          Selection only
        </Button>
      </div>
    </section>

    <section class="mb-3">
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Tools
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          size="sm"
          :variant="props.state.mode === 'off' ? 'default' : 'outline'"
          class="justify-start"
          @click="setMode('off')"
        >
          Off
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'distance' ? 'default' : 'outline'"
          class="justify-start"
          @click="setMode('distance')"
        >
          Distance
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'freeform' ? 'default' : 'outline'"
          class="justify-start"
          @click="activateAreaShape('freeform')"
        >
          Polygon
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'rectangle' ? 'default' : 'outline'"
          class="justify-start"
          @click="activateAreaShape('rectangle')"
        >
          Rectangle
        </Button>
        <Button
          size="sm"
          :variant="props.state.mode === 'area' && props.state.areaShape === 'circle' ? 'default' : 'outline'"
          class="justify-start sm:col-span-2"
          @click="activateAreaShape('circle')"
        >
          Circle
        </Button>
      </div>
    </section>

    <section class="mb-3 grid gap-2 sm:grid-cols-2">
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Mode</div>
        <div class="text-sm font-medium">{{ props.state.mode }}</div>
      </div>
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Area Shape</div>
        <div class="text-sm font-medium">
          {{ props.state.mode === "area" ? props.state.areaShape : "n/a" }}
        </div>
      </div>
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Distance</div>
        <div class="text-sm font-medium tabular-nums">
          {{ formatDistance(props.state.distanceKm) }}
        </div>
      </div>
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Area</div>
        <div class="text-sm font-medium tabular-nums">{{ formatArea(props.state.areaSqKm) }}</div>
      </div>
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Selection</div>
        <div class="text-sm font-medium">
          {{ props.state.isSelectionComplete ? "Complete" : "In progress" }}
        </div>
      </div>
      <div class="rounded-md border border-border/60 bg-background/60 px-3 py-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Vertices</div>
        <div class="text-sm font-medium tabular-nums">{{ props.state.vertexCount }}</div>
      </div>
    </section>

    <footer class="flex items-center gap-2">
      <Button
        size="sm"
        class="flex-1"
        :disabled="props.state.mode !== 'area' || !props.state.canFinishSelection"
        @click="finishSelection"
      >
        Finish selection
      </Button>
      <Button size="sm" variant="ghost" @click="clearMeasure">Clear</Button>
    </footer>
  </aside>
</template>
