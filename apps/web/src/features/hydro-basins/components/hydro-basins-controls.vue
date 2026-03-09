<script setup lang="ts">
  import { computed } from "vue";
  import { hydroBasinsControlMetadata } from "@/features/hydro-basins/hydro-basins.service";

  interface HydroBasinsControlsProps {
    readonly embedded?: boolean;
    readonly showZoomHint: boolean;
    readonly visible: boolean;
  }

  const props = withDefaults(defineProps<HydroBasinsControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:visible": [value: boolean];
  }>();

  const containerClass = computed(() =>
    props.embedded ? "w-full" : "map-glass-panel w-full rounded-lg p-3"
  );

  const metadata = hydroBasinsControlMetadata();

  function onToggle(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:visible", target.checked);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Hydro basins layer">
    <label class="map-glass-card flex cursor-pointer items-start gap-3 rounded-md p-2">
      <input class="mt-0.5 h-4 w-4" type="checkbox" :checked="props.visible" @change="onToggle">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: metadata.color }"
            aria-hidden="true"
          />
          <span class="text-xs font-medium">{{ metadata.label }}</span>
        </div>
        <p class="mt-1 break-words text-[11px] text-muted-foreground">{{ metadata.description }}</p>
        <p
          v-if="props.showZoomHint"
          class="mt-1 break-words text-[11px] font-mono text-muted-foreground"
        >
          Zoom in to view.
        </p>
      </div>
    </label>
  </aside>
</template>
