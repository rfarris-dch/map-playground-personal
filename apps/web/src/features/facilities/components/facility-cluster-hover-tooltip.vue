<script setup lang="ts">
  import { computed, ref, watch } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import type { FacilityClusterHoverState } from "@/features/facilities/hover.types";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface Props {
    readonly hoverState: FacilityClusterHoverState | null;
  }

  interface Emits {
    "zoom-to-cluster": [
      perspective: FacilityClusterHoverState["perspective"],
      clusterId: number,
      center: readonly [number, number],
    ];
  }

  const props = defineProps<Props>();
  defineEmits<Emits>();

  const isMouseOver = ref(false);
  const displayState = ref<FacilityClusterHoverState | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const accentText = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "text-hyper-500" : "text-colo-500"
  );

  const accentBorder = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "border-hyper-500" : "border-colo-500"
  );

  const titleLine = computed(() => {
    const state = displayState.value;
    if (state === null) {
      return "";
    }
    const providerCount = state.topProviders.length;
    const facilityCount = state.facilityCount;
    const providerLabel = state.perspective === "hyperscale" ? "Users" : "Providers";
    return `${providerCount} ${providerLabel} • ${facilityCount} Facilities`;
  });

  const totalMw = computed(() => {
    const state = displayState.value;
    if (state === null) {
      return "";
    }
    return `(${formatMegawatts(state.totalPowerMw)})`;
  });

  interface Metric {
    readonly label: string;
    readonly value: string;
  }

  function formatCompact(value: number): string {
    if (value >= 100) {
      return Math.round(value).toLocaleString();
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  const metrics = computed<Metric[]>(() => {
    const state = displayState.value;
    if (state === null) {
      return [];
    }

    const result: Metric[] = [];
    if (state.commissionedPowerMw > 0) {
      const label = state.perspective === "hyperscale" ? "Own." : "Comm.";
      result.push({ label, value: formatCompact(state.commissionedPowerMw) });
    }
    if (state.perspective === "colocation" && state.availablePowerMw > 0) {
      result.push({ label: "Avail.", value: formatCompact(state.availablePowerMw) });
    }
    if (state.underConstructionPowerMw > 0) {
      result.push({ label: "UC", value: formatCompact(state.underConstructionPowerMw) });
    }
    if (state.plannedPowerMw > 0) {
      result.push({ label: "Plan.", value: formatCompact(state.plannedPowerMw) });
    }
    return result;
  });

  function onMouseEnter(): void {
    isMouseOver.value = true;
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function onMouseLeave(): void {
    isMouseOver.value = false;
    if (props.hoverState === null) {
      displayState.value = null;
    }
  }

  watch(
    () => props.hoverState,
    (next) => {
      if (next !== null) {
        if (dismissTimer !== null) {
          clearTimeout(dismissTimer);
          dismissTimer = null;
        }
        displayState.value = next;
        return;
      }

      if (!isMouseOver.value) {
        dismissTimer = setTimeout(() => {
          displayState.value = null;
          dismissTimer = null;
        }, 200);
      }
    }
  );
</script>

<template>
  <MapTooltipShell
    ariaLabel="Facility cluster details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :surface-class="`pointer-events-auto absolute z-30 flex flex-col items-center justify-center rounded-[8px] border border-solid p-1 shadow-md ${accentBorder}`"
  >
    <div
      v-if="displayState !== null"
      class="flex flex-col items-start justify-center gap-2 rounded-[8px] bg-white p-2 shadow-md leading-normal whitespace-nowrap"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div class="flex items-center gap-2">
        <span class="text-[16px] font-semibold leading-none" :class="accentText">
          {{ titleLine }}
        </span>
        <span class="text-[12px] font-normal leading-none text-[#94a3b8]"> {{ totalMw }} </span>
      </div>

      <div v-if="metrics.length > 0" class="flex items-start gap-2">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="flex items-center justify-center gap-2"
        >
          <span class="text-[16px] font-normal leading-none text-[#94a3b8]">
            {{ metric.label }}
          </span>
          <span class="text-[16px] font-semibold leading-none" :class="accentText">
            {{ metric.value }}
          </span>
        </div>
      </div>
    </div>
  </MapTooltipShell>
</template>
