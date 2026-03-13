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
      ? "w-full font-sans text-muted-foreground"
      : "w-full rounded-sm border border-border bg-card p-3 shadow-md font-sans text-muted-foreground"
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

  function rowClass(visible: boolean): string {
    if (visible) {
      return "border-border bg-background shadow-sm";
    }

    return "border-transparent bg-card hover:border-border hover:bg-background";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Flood risk layers">
    <div class="grid gap-2">
      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.flood100Visible)"
      >
        <input
          class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.flood100Visible"
          @change="onToggleFlood100"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.flood100Visible ? 'text-foreground/70' : 'text-muted-foreground'"
            >
              {{ flood100Metadata.label }}
            </span>
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.flood100Visible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ flood100Metadata.description }}
          </p>
          <p
            v-if="props.showFlood100ZoomHint"
            class="mt-1 break-words text-xs transition-colors"
            :class="props.flood100Visible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            Zoom in to view.
          </p>
        </div>
      </label>

      <label
        class="group flex min-h-[44px] cursor-pointer items-start gap-2 rounded-sm border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 focus-within:outline-none"
        :class="rowClass(props.flood500Visible)"
      >
        <input
          class="h-4 w-4 shrink-0 rounded-sm border border-border accent-muted-foreground"
          type="checkbox"
          :checked="props.flood500Visible"
          @change="onToggleFlood500"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" />
            <span
              class="text-xs font-semibold transition-colors"
              :class="props.flood500Visible ? 'text-foreground/70' : 'text-muted-foreground'"
            >
              {{ flood500Metadata.label }}
            </span>
          </div>
          <p
            class="mt-1 break-words text-xs transition-colors"
            :class="props.flood500Visible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            {{ flood500Metadata.description }}
          </p>
          <p
            v-if="props.showFlood500ZoomHint"
            class="mt-1 break-words text-xs transition-colors"
            :class="props.flood500Visible ? 'text-foreground/70' : 'text-muted-foreground'"
          >
            Zoom in to view.
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
