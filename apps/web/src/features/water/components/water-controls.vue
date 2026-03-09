<script setup lang="ts">
  import { computed } from "vue";

  interface WaterControlsProps {
    readonly embedded?: boolean;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<WaterControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();

  const containerClass = computed(() =>
    props.embedded ? "w-full" : "map-glass-panel w-full rounded-lg p-3"
  );

  function onToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:visible", target.checked);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Water features layer">
    <header v-if="!props.embedded" class="mb-2 flex items-center justify-between">
      <h2 class="m-0 text-xs font-semibold tracking-wide">Water</h2>
      <span class="text-[11px] text-muted-foreground">USGS raster overlay</span>
    </header>

    <label class="map-glass-card flex cursor-pointer items-start gap-3 rounded-md p-2">
      <input class="mt-0.5 h-4 w-4" type="checkbox" :checked="props.visible" @change="onToggle">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-[#5d69b1]" aria-hidden="true" />
          <span class="text-xs font-medium">USGS Water Features</span>
        </div>
        <p class="mt-1 break-words text-[11px] text-muted-foreground">
          Rivers, streams, lakes, and reservoirs from the HydroCached raster service
        </p>
      </div>
    </label>
  </aside>
</template>
