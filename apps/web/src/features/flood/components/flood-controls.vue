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
      ? "w-full [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
      : "w-full rounded-[4px] border border-[#E2E8F0] bg-white p-3 shadow-[0_4px_8px_rgba(0,0,0,0.06)] [font-family:Inter,var(--font-sans)] text-[#94A3B8]"
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
      return "border-[#CBD5E1] bg-[#F8FAFC] shadow-[0_1px_2px_rgba(15,23,42,0.04)]";
    }

    return "border-transparent bg-white hover:border-[#E2E8F0] hover:bg-[#F8FAFC]";
  }
</script>

<template>
  <aside :class="containerClass" aria-label="Flood risk layers">
    <div class="grid gap-2">
      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.flood100Visible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.flood100Visible"
          @change="onToggleFlood100"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#60A5FA]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.flood100Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
            >
              {{ flood100Metadata.label }}
            </span>
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.flood100Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ flood100Metadata.description }}
          </p>
          <p
            v-if="props.showFlood100ZoomHint"
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.flood100Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            Zoom in to view.
          </p>
        </div>
      </label>

      <label
        class="group flex cursor-pointer items-start gap-2 rounded-[4px] border px-3 py-1 transition-colors"
        :class="rowClass(props.flood500Visible)"
      >
        <input
          class="mt-[1px] h-[10px] w-[10px] rounded-[2px] border border-[#CBD5E1] accent-[#94A3B8]"
          type="checkbox"
          :checked="props.flood500Visible"
          @change="onToggleFlood500"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />
            <span
              class="text-[10px] font-semibold transition-colors"
              :class="props.flood500Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
            >
              {{ flood500Metadata.label }}
            </span>
          </div>
          <p
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.flood500Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            {{ flood500Metadata.description }}
          </p>
          <p
            v-if="props.showFlood500ZoomHint"
            class="mt-1 break-words text-[10px] transition-colors"
            :class="props.flood500Visible ? 'text-[#64748B]' : 'text-[#94A3B8]'"
          >
            Zoom in to view.
          </p>
        </div>
      </label>
    </div>
  </aside>
</template>
