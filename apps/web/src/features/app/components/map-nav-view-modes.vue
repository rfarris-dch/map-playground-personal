<script setup lang="ts">
  import { computed } from "vue";
  import MapNavIcon from "@/components/icons/map-nav-icon.vue";
  import type { MapNavViewModeId } from "@/features/app/components/map-nav.types";

  interface MapNavViewModesProps {
    readonly activeMode: MapNavViewModeId;
  }

  interface MapNavViewModesEmits {
    "update:active-mode": [id: MapNavViewModeId];
  }

  const props = defineProps<MapNavViewModesProps>();
  const emit = defineEmits<MapNavViewModesEmits>();

  const modes: readonly { id: MapNavViewModeId; label: string }[] = [
    { id: "clusters", label: "Clusters" },
    { id: "bubbles", label: "Bubbles" },
    { id: "icons", label: "Icons" },
    { id: "dots", label: "Dots" },
    { id: "heatmap", label: "Heatmap" },
  ];

  function iconSizeClass(modeId: MapNavViewModeId): string {
    switch (modeId) {
      case "clusters":
        return "h-2 w-[6px]";
      case "icons":
        return "h-[14px] w-[14px]";
      case "bubbles":
        return "h-[9.147px] w-2";
      case "dots":
        return "h-[7.462px] w-2";
      case "heatmap":
        return "h-[6.203px] w-2";
      default:
        return "h-2 w-[6px]";
    }
  }

  const iconSizeClasses = computed(() => ({
    bubbles: iconSizeClass("bubbles"),
    clusters: iconSizeClass("clusters"),
    dots: iconSizeClass("dots"),
    heatmap: iconSizeClass("heatmap"),
    icons: iconSizeClass("icons"),
  }));

  function selectMode(id: MapNavViewModeId): void {
    emit("update:active-mode", id);
  }
</script>

<template>
  <div class="flex items-end bg-white px-1 py-2">
    <div class="flex h-[38px] items-center gap-1 rounded-full bg-[#F8FAFC] p-2">
      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        class="flex h-[22px] cursor-pointer items-center gap-1 px-1.5 py-0.5 transition-colors"
        :class="
          props.activeMode === mode.id
            ? 'rounded-full bg-[#647287] text-white'
            : 'rounded-[4px] text-[#94A3B8] hover:text-[#64748B]'
        "
        @click="selectMode(mode.id)"
      >
        <MapNavIcon :name="mode.id" :class="iconSizeClasses[mode.id]" class="shrink-0" />
        <span class="text-[10px] leading-none">{{ mode.label }}</span>
      </button>
    </div>
  </div>
</template>
