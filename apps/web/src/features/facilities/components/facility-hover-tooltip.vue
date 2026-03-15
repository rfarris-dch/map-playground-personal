<script setup lang="ts">
  import { computed, shallowRef, watch } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import type { FacilityHoverState } from "@/features/facilities/hover.types";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface FacilityHoverTooltipProps {
    readonly hoverState: FacilityHoverState | null;
  }

  interface PowerMetric {
    readonly label: string;
    readonly value: string;
  }

  const emit = defineEmits<{
    select: [facilityId: string, perspective: string];
  }>();

  const props = defineProps<FacilityHoverTooltipProps>();

  const pinnedState = shallowRef<FacilityHoverState | null>(null);
  const isMouseInTooltip = shallowRef(false);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const displayState = computed(() => pinnedState.value ?? props.hoverState);

  watch(
    () => props.hoverState,
    (next) => {
      if (next !== null) {
        if (dismissTimer !== null) {
          clearTimeout(dismissTimer);
          dismissTimer = null;
        }
        pinnedState.value = next;
      } else if (!isMouseInTooltip.value) {
        dismissTimer = setTimeout(() => {
          pinnedState.value = null;
          dismissTimer = null;
        }, 120);
      }
    }
  );

  function onTooltipEnter(): void {
    isMouseInTooltip.value = true;
    if (dismissTimer !== null) {
      clearTimeout(dismissTimer);
      dismissTimer = null;
    }
  }

  function onTooltipLeave(): void {
    isMouseInTooltip.value = false;
    if (props.hoverState === null) {
      pinnedState.value = null;
    }
  }

  function onSelectFacility(): void {
    const state = displayState.value;
    if (state === null) {
      return;
    }

    emit("select", state.facilityId, state.perspective);
    pinnedState.value = null;
  }

  const accentBgClass = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "bg-hyperscale" : "bg-colocation"
  );
  const accentBorderClass = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "border-hyperscale" : "border-colocation"
  );
  const accentTextClass = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "text-hyperscale" : "text-colocation"
  );
  const powerMetrics = computed<PowerMetric[]>(() => {
    const hoverState = displayState.value;
    if (hoverState === null) {
      return [];
    }

    const metrics: PowerMetric[] = [];
    if (hoverState.commissionedPowerMw !== null) {
      metrics.push({
        label: "Comm.",
        value: formatMegawatts(hoverState.commissionedPowerMw),
      });
    }
    if (hoverState.underConstructionPowerMw !== null) {
      metrics.push({
        label: "UC",
        value: formatMegawatts(hoverState.underConstructionPowerMw),
      });
    }
    if (hoverState.plannedPowerMw !== null) {
      metrics.push({
        label: "Plan.",
        value: formatMegawatts(hoverState.plannedPowerMw),
      });
    }
    if (hoverState.availablePowerMw !== null) {
      metrics.push({
        label: "Avail.",
        value: formatMegawatts(hoverState.availablePowerMw),
      });
    }

    return metrics;
  });
  const statusText = computed(() => {
    if (displayState.value === null) {
      return "";
    }

    return displayState.value.statusLabel ?? displayState.value.commissionedSemantic;
  });
</script>

<template>
  <MapTooltipShell
    ariaLabel="Facility hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :surface-class="`pointer-events-auto absolute z-30 rounded-sm border p-0.5 ${accentBorderClass}`"
  >
    <div
      v-if="displayState !== null"
      class="flex w-[min(190px,calc(100vw-2rem))] flex-col gap-2 rounded-sm bg-card p-2 shadow-sm"
      @mouseenter="onTooltipEnter"
      @mouseleave="onTooltipLeave"
    >
      <div class="flex items-center justify-between gap-1">
        <div class="flex items-center gap-1 overflow-hidden leading-none">
          <span class="truncate text-xs font-semibold" :class="accentTextClass">
            {{ displayState.facilityName }}
          </span>
          <span class="flex-shrink-0 text-xs text-muted-foreground">{{ statusText }}</span>
        </div>
        <button
          type="button"
          class="flex-shrink-0 opacity-40 hover:opacity-80"
          aria-label="Dismiss tooltip"
          @click="pinnedState = null"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
            <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
          </svg>
        </button>
      </div>

      <div class="flex flex-col gap-0 text-xs leading-[1.4] text-muted-foreground">
        <span>{{ displayState.providerName }}</span>
        <span v-if="displayState.leaseOrOwn !== null">{{ displayState.leaseOrOwn }}</span>
      </div>

      <div v-if="powerMetrics.length > 0" class="flex gap-1">
        <div
          v-for="metric in powerMetrics"
          :key="metric.label"
          class="flex w-[40px] flex-col items-center gap-0.5 rounded-sm px-1 py-1"
          :class="accentBgClass"
        >
          <span class="text-xs leading-none text-white/80">{{ metric.label }}</span>
          <span class="text-xs font-semibold leading-none text-white">{{ metric.value }}</span>
        </div>
      </div>

      <button
        type="button"
        class="flex items-center gap-0.5 hover:underline"
        :class="accentTextClass"
        @click="onSelectFacility"
      >
        <span class="text-xs">View Details</span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M6 4l4 4-4 4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </MapTooltipShell>
</template>
