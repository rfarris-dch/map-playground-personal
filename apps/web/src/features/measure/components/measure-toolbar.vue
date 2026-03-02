<script setup lang="ts">
  import Button from "@/components/ui/button/button.vue";
  import { formatArea, formatDistance } from "../measure.service";
  import type { MeasureMode, MeasureState } from "../measure.types";

  interface MeasureToolbarProps {
    readonly state: MeasureState;
  }

  const props = defineProps<MeasureToolbarProps>();

  const emit = defineEmits<{
    clear: [];
    "set-mode": [mode: MeasureMode];
  }>();

  function setMode(mode: MeasureMode): void {
    emit("set-mode", mode);
  }

  function clearMeasure(): void {
    emit("clear");
  }
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 left-4 z-20 w-[min(26rem,calc(100%-2rem))] rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
    aria-label="Measurement tools"
  >
    <header class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Measure</h2>
      <span class="text-[11px] text-muted-foreground">Click map to add vertices</span>
    </header>

    <div class="mb-2 flex flex-wrap gap-2">
      <Button
        size="sm"
        :variant="props.state.mode === 'off' ? 'default' : 'outline'"
        @click="setMode('off')"
      >
        Off
      </Button>
      <Button
        size="sm"
        :variant="props.state.mode === 'distance' ? 'default' : 'outline'"
        @click="setMode('distance')"
      >
        Distance
      </Button>
      <Button
        size="sm"
        :variant="props.state.mode === 'area' ? 'default' : 'outline'"
        @click="setMode('area')"
      >
        Area
      </Button>
      <Button size="sm" variant="ghost" class="ml-auto" @click="clearMeasure">Clear</Button>
    </div>

    <dl class="m-0 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px]">
      <dt class="text-muted-foreground">Mode</dt>
      <dd class="m-0">{{ props.state.mode }}</dd>

      <dt class="text-muted-foreground">Vertices</dt>
      <dd class="m-0 font-mono">{{ props.state.vertexCount }}</dd>

      <dt class="text-muted-foreground">Distance</dt>
      <dd class="m-0 font-mono">{{ formatDistance(props.state.distanceKm) }}</dd>

      <dt class="text-muted-foreground">Area</dt>
      <dd class="m-0 font-mono">{{ formatArea(props.state.areaSqKm) }}</dd>
    </dl>
  </aside>
</template>
