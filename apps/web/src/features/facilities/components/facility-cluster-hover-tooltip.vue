<script setup lang="ts">
  import { computed, ref, toRef, watch } from "vue";
  import MapTooltipShell from "@/components/map/map-tooltip-shell.vue";
  import {
    buildFacilityClusterPowerSegments,
    getFacilityClusterPrimaryLabel,
  } from "@/features/facilities/facilities-cluster.service";
  import type { FacilityClusterHoverState } from "@/features/facilities/hover.types";
  import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface FacilityClusterHoverTooltipProps {
    readonly hoverState: FacilityClusterHoverState | null;
  }

  interface FacilityClusterHoverTooltipEmits {
    "zoom-to-cluster": [
      perspective: FacilityClusterHoverState["perspective"],
      clusterId: number,
      center: readonly [number, number],
    ];
  }

  interface ClusterMetricRow {
    readonly label: string;
    readonly value: number;
  }

  const props = defineProps<FacilityClusterHoverTooltipProps>();
  const emit = defineEmits<FacilityClusterHoverTooltipEmits>();

  const isMouseOver = ref(false);
  const displayState = ref<FacilityClusterHoverState | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const clusterScreenPoint = toRef(() => displayState.value?.screenPoint ?? null);
  const accentBorderClass = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "border-hyperscale" : "border-colocation"
  );
  const accentTextClass = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "text-hyperscale" : "text-colocation"
  );
  const donutSegments = computed(() =>
    buildDonutChartArcSegments({
      centerX: 34,
      centerY: 34,
      radius: 24,
      segments: pieSegments(),
    })
  );
  const metricRows = computed<ClusterMetricRow[]>(() => {
    const hoverState = displayState.value;
    if (hoverState === null) {
      return [];
    }

    const rows: ClusterMetricRow[] = [
      {
        label: getFacilityClusterPrimaryLabel(hoverState.perspective),
        value: hoverState.commissionedPowerMw,
      },
      {
        label: "Under Construction",
        value: hoverState.underConstructionPowerMw,
      },
      {
        label: "Planned",
        value: hoverState.plannedPowerMw,
      },
    ];

    if (hoverState.perspective === "colocation") {
      rows.splice(1, 0, {
        label: "Available",
        value: hoverState.availablePowerMw,
      });
    }

    return rows;
  });
  const providerLabel = computed(() =>
    displayState.value?.perspective === "hyperscale" ? "Top Users" : "Top Providers"
  );
  const tooltipState = computed(() => displayState.value);
  const perspectiveLabel = computed(() => {
    if (displayState.value === null) {
      return "";
    }

    return displayState.value.perspective === "hyperscale" ? "Hyperscale" : "Colocation";
  });

  function pieSegments() {
    if (displayState.value === null) {
      return [];
    }

    return buildFacilityClusterPowerSegments(displayState.value);
  }

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

  function onZoomClick(): void {
    if (displayState.value === null) {
      return;
    }

    emit(
      "zoom-to-cluster",
      displayState.value.perspective,
      displayState.value.clusterId,
      displayState.value.center
    );
  }

  watch(
    () => props.hoverState,
    (nextHoverState) => {
      if (nextHoverState !== null) {
        if (dismissTimer !== null) {
          clearTimeout(dismissTimer);
          dismissTimer = null;
        }
        displayState.value = nextHoverState;
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
    :screen-point="clusterScreenPoint"
    :show="tooltipState !== null"
    :surface-class="`absolute z-30 rounded-sm border p-0.5 ${accentBorderClass}`"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      v-if="tooltipState !== null"
      class="flex flex-col gap-2.5 rounded-sm bg-card p-2.5 shadow-sm"
    >
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-semibold leading-none whitespace-nowrap" :class="accentTextClass">
          {{ perspectiveLabel }}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          class="flex-shrink-0 cursor-pointer opacity-40 hover:opacity-70"
          aria-hidden="true"
        >
          <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
          <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </div>

      <div class="flex items-start gap-3.5">
        <div class="relative flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
            <circle cx="34" cy="34" r="24" fill="none" stroke="var(--muted)" stroke-width="10" />
            <template v-for="(segment, index) in donutSegments" :key="`cluster-${String(index)}`">
              <circle
                v-if="segment.path === null"
                cx="34"
                cy="34"
                r="24"
                fill="none"
                :stroke="segment.color"
                stroke-width="10"
                stroke-linecap="butt"
              />
              <path
                v-else
                :d="segment.path"
                fill="none"
                :stroke="segment.color"
                stroke-width="10"
                stroke-linecap="butt"
              />
            </template>
          </svg>
          <div class="pointer-events-none absolute inset-0 grid place-items-center px-2">
            <span
              class="block max-w-[38px] text-center text-xs leading-none tracking-tight text-muted-foreground"
            >
              {{ formatMegawatts(tooltipState.totalPowerMw) }}
            </span>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-semibold text-muted-foreground">{{ providerLabel }}</span>
          <div class="flex flex-col gap-1.5">
            <template v-for="provider in tooltipState.topProviders" :key="provider.name">
              <div class="flex flex-col gap-0.5">
                <span class="text-xs leading-none" :class="accentTextClass">
                  {{ provider.name }}
                </span>
                <span class="text-xs leading-none text-muted-foreground">
                  {{ formatMegawatts(provider.totalPowerMw) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-1.5">
        <div
          v-for="metricRow in metricRows"
          :key="metricRow.label"
          class="rounded-sm border border-border/60 bg-background/70 px-2 py-1.5"
        >
          <span class="block text-[11px] leading-none text-muted-foreground"
            >{{ metricRow.label }}</span
          >
          <span class="mt-1 block text-xs font-semibold leading-none"
            >{{ formatMegawatts(metricRow.value) }}</span
          >
        </div>
      </div>

      <div v-if="tooltipState.facilities.length > 0" class="flex flex-col gap-1">
        <span class="text-[11px] font-semibold text-muted-foreground">Facilities</span>
        <div class="max-h-[160px] overflow-y-auto rounded-sm border border-border/60">
          <table class="w-full text-[11px]">
            <thead>
              <tr class="border-b border-border/40 bg-background/70">
                <th class="px-1.5 py-1 text-left font-medium text-muted-foreground">Name</th>
                <th class="px-1.5 py-1 text-left font-medium text-muted-foreground">Provider</th>
                <th class="px-1.5 py-1 text-right font-medium text-muted-foreground">MW</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(facility, index) in tooltipState.facilities"
                :key="index"
                class="border-b border-border/20 last:border-b-0"
              >
                <td class="max-w-[100px] truncate px-1.5 py-1" :class="accentTextClass">
                  {{ facility.facilityName }}
                </td>
                <td class="max-w-[80px] truncate px-1.5 py-1 text-muted-foreground">
                  {{ facility.providerName }}
                </td>
                <td class="px-1.5 py-1 text-right font-medium tabular-nums">
                  {{ formatMegawatts(
                      facility.commissionedPowerMw +
                        facility.underConstructionPowerMw +
                        facility.plannedPowerMw
                    ) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <button
        type="button"
        class="flex items-center justify-between rounded-sm border border-border/60 bg-background/70 px-2.5 py-1.5 text-left transition-colors hover:border-border hover:bg-background"
        @click="onZoomClick"
      >
        <span class="text-xs font-semibold" :class="accentTextClass">Zoom to cluster</span>
        <span class="text-xs text-muted-foreground">
          {{ tooltipState.facilityCount.toLocaleString() }}
          sites
        </span>
      </button>
    </div>
  </MapTooltipShell>
</template>
