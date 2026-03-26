<script setup lang="ts">
  import { computed, shallowRef, watch } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import {
    buildFacilityPopupAddressText,
    buildFacilityPopupCodeText,
  } from "@/features/facilities/facility-popup.service";
  import type { FacilityHoverState } from "@/features/facilities/hover.types";

  interface Props {
    readonly hoverState: FacilityHoverState | null;
  }

  interface Metric {
    readonly label: string;
    readonly value: string;
  }

  const props = defineProps<Props>();

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

  const accentText = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "text-hyper-500" : "text-colo-500"
  );

  const accentBorder = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "border-hyper-500" : "border-colo-500"
  );

  const codeText = computed(() => {
    const state = displayState.value;
    if (state === null) {
      return null;
    }

    return buildFacilityPopupCodeText({
      facilityCode: state.facilityCode,
      providerName: state.providerName,
    });
  });

  const addressText = computed(() => {
    const state = displayState.value;
    if (state === null) {
      return null;
    }

    return buildFacilityPopupAddressText({
      address: state.address,
      city: state.city,
      facilityCode: state.facilityCode,
      facilityName: state.facilityName,
      providerName: state.providerName,
      stateAbbrev: state.stateAbbrev,
    });
  });

  function formatCompact(value: number): string {
    const num =
      value >= 100
        ? Math.round(value).toLocaleString()
        : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
    return `${num} MW`;
  }

  const metrics = computed<Metric[]>(() => {
    const state = displayState.value;
    if (state === null) {
      return [];
    }

    const result: Metric[] = [];
    const isHyperscale = state.perspective === "hyperscale";

    if (!isHyperscale && state.leaseOrOwn !== null && state.leaseOrOwn !== "unknown") {
      result.push({
        label: state.leaseOrOwn === "own" ? "Own." : "Lease",
        value: state.leaseOrOwn === "own" ? "O" : "L",
      });
    }

    if (state.commissionedPowerMw !== null && state.commissionedPowerMw > 0) {
      result.push({
        label: isHyperscale ? "Own." : "Comm.",
        value: formatCompact(state.commissionedPowerMw),
      });
    }
    if (state.underConstructionPowerMw !== null && state.underConstructionPowerMw > 0) {
      result.push({ label: "UC", value: formatCompact(state.underConstructionPowerMw) });
    }
    if (state.plannedPowerMw !== null && state.plannedPowerMw > 0) {
      result.push({ label: "Plan.", value: formatCompact(state.plannedPowerMw) });
    }
    if (state.availablePowerMw !== null && state.availablePowerMw > 0) {
      result.push({ label: "Avail.", value: formatCompact(state.availablePowerMw) });
    }

    return result;
  });
</script>

<template>
  <MapTooltipShell
    ariaLabel="Facility hover details"
    :screen-point="displayState?.screenPoint ?? null"
    :show="displayState !== null"
    :surface-class="`pointer-events-auto absolute z-30 flex flex-col items-center justify-center rounded-[8px] border-2 border-solid bg-white shadow-md ${accentBorder}`"
  >
    <div
      v-if="displayState !== null"
      class="flex flex-col items-start justify-center gap-1 p-2 leading-normal whitespace-nowrap"
      @mouseenter="onTooltipEnter"
      @mouseleave="onTooltipLeave"
    >
      <div class="flex items-center gap-2">
        <span class="text-[14px] font-semibold leading-none" :class="accentText">
          {{ displayState.providerName }}
        </span>
        <span v-if="codeText" class="text-[11px] font-normal leading-none text-[#94a3b8]">
          {{ codeText }}
        </span>
      </div>

      <span v-if="addressText" class="text-[11px] font-normal leading-none text-[#94a3b8]">
        {{ addressText }}
      </span>

      <div v-if="metrics.length > 0" class="flex items-start gap-2">
        <div
          v-for="metric in metrics"
          :key="metric.label"
          class="flex items-center justify-center gap-1"
        >
          <span class="text-[13px] font-normal leading-none text-[#94a3b8]">
            {{ metric.label }}
          </span>
          <span class="text-[13px] font-semibold leading-none" :class="accentText">
            {{ metric.value }}
          </span>
        </div>
      </div>
    </div>
  </MapTooltipShell>
</template>
