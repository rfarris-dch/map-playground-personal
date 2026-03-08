<script setup lang="ts">
  import { computed } from "vue";
  import { floodControlMetadata } from "@/features/flood/flood.service";

  interface FloodControlsProps {
    readonly embedded?: boolean;
    readonly flood100Visible: boolean;
    readonly flood500Visible: boolean;
    readonly showFlood100ZoomHint: boolean;
    readonly showFlood500ZoomHint: boolean;
  }

  const props = withDefaults(defineProps<FloodControlsProps>(), {
    embedded: false,
  });

  const emit = defineEmits<{
    "update:flood100-visible": [value: boolean];
    "update:flood500-visible": [value: boolean];
  }>();

  const containerClass = computed(() =>
    props.embedded
      ? "w-full"
      : "w-full rounded-lg border border-border/90 bg-card/95 p-3 shadow-lg backdrop-blur-sm"
  );

  const flood100Metadata = floodControlMetadata("flood-100");
  const flood500Metadata = floodControlMetadata("flood-500");

  function onToggleFlood100(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:flood100-visible", target.checked);
  }

  function onToggleFlood500(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    emit("update:flood500-visible", target.checked);
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Flood risk layers">
    <div class="grid gap-2">
      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.flood100Visible"
          @change="onToggleFlood100"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: flood100Metadata.color }"
              aria-hidden="true"
            />
            <span class="text-xs font-medium">{{ flood100Metadata.label }}</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">
            {{ flood100Metadata.description }}
          </p>
          <p
            v-if="props.showFlood100ZoomHint"
            class="mt-1 break-words text-[11px] font-mono text-muted-foreground"
          >
            Zoom in to view.
          </p>
        </div>
      </label>

      <label class="flex cursor-pointer items-start gap-3 rounded-md border border-border/70 p-2">
        <input
          class="mt-0.5 h-4 w-4"
          type="checkbox"
          :checked="props.flood500Visible"
          @change="onToggleFlood500"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span
              class="h-2.5 w-2.5 rounded-full"
              :style="{ backgroundColor: flood500Metadata.color }"
              aria-hidden="true"
            />
            <span class="text-xs font-medium">{{ flood500Metadata.label }}</span>
          </div>
          <p class="mt-1 break-words text-[11px] text-muted-foreground">
            {{ flood500Metadata.description }}
          </p>
          <p
            v-if="props.showFlood500ZoomHint"
            class="mt-1 break-words text-[11px] font-mono text-muted-foreground"
          >
            Zoom in to view.
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
