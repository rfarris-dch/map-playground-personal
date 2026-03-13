<script setup lang="ts">
  import { ref, toRef, watch } from "vue";
  import { useTooltipPosition } from "@/composables/use-tooltip-position";
  import {
    buildFacilityClusterPowerSegments,
    getFacilityClusterPrimaryLabel,
  } from "@/features/facilities/facilities-cluster.service";
  import type { FacilityClusterHoverState } from "@/features/facilities/hover.types";
  import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";

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

  const props = defineProps<FacilityClusterHoverTooltipProps>();
  const emit = defineEmits<FacilityClusterHoverTooltipEmits>();

  function onZoomClick(): void {
    if (!displayState.value) {
      return;
    }
    emit(
      "zoom-to-cluster",
      displayState.value.perspective,
      displayState.value.clusterId,
      displayState.value.center
    );
  }

  const isMouseOver = ref(false);
  const displayState = ref<FacilityClusterHoverState | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  const clusterScreenPoint = toRef(() => displayState.value?.screenPoint ?? null);
  const { style: positionStyle } = useTooltipPosition(clusterScreenPoint);

  watch(
    () => props.hoverState,
    (next) => {
      if (next !== null) {
        if (dismissTimer !== null) {
          clearTimeout(dismissTimer);
          dismissTimer = null;
        }
        displayState.value = next;
      } else if (!isMouseOver.value) {
        dismissTimer = setTimeout(() => {
          displayState.value = null;
          dismissTimer = null;
        }, 200);
      }
    }
  );

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

  function formatMw(value: number): string {
    if (value === 0) {
      return "0 MW";
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  }

  function perspectiveLabel(): string {
    if (!displayState.value) {
      return "";
    }
    const count = displayState.value.facilityCount;
    if (displayState.value.perspective === "hyperscale") {
      return `${count} Hyperscale ${count === 1 ? "Facility" : "Facilities"}`;
    }
    return `${count} Colocation ${count === 1 ? "Facility" : "Facilities"}`;
  }

  function accentColor(): string {
    const style = getComputedStyle(document.documentElement);
    return displayState.value?.perspective === "hyperscale"
      ? style.getPropertyValue("--hyperscale").trim()
      : style.getPropertyValue("--colocation").trim();
  }

  function accentClass(): string {
    return displayState.value?.perspective === "hyperscale"
      ? "border-hyperscale"
      : "border-colocation";
  }

  function accentTextClass(): string {
    return displayState.value?.perspective === "hyperscale"
      ? "text-hyperscale"
      : "text-colocation";
  }

  function providerLabel(): string {
    return displayState.value?.perspective === "hyperscale" ? "Top Users" : "Top Providers";
  }

  interface ClusterMetricRow {
    label: string;
    value: number;
  }

  function pieSegments() {
    if (!displayState.value) {
      return [];
    }

    return buildFacilityClusterPowerSegments(displayState.value);
  }

  function metricRows(): ClusterMetricRow[] {
    if (!displayState.value) {
      return [];
    }

    const rows: ClusterMetricRow[] = [
      {
        label: getFacilityClusterPrimaryLabel(displayState.value.perspective),
        value: displayState.value.commissionedPowerMw,
      },
      {
        label: "Under Construction",
        value: displayState.value.underConstructionPowerMw,
      },
      {
        label: "Planned",
        value: displayState.value.plannedPowerMw,
      },
    ];

    if (displayState.value.perspective === "colocation") {
      rows.splice(1, 0, {
        label: "Available",
        value: displayState.value.availablePowerMw,
      });
    }

    return rows;
  }

  function donutSegments() {
    return buildDonutChartArcSegments({
      centerX: 34,
      centerY: 34,
      radius: 24,
      segments: pieSegments(),
    });
  }
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-100"
    enter-from-class="opacity-0"
  >
  <aside
    v-if="displayState !== null"
    class="absolute z-30 rounded-sm border p-[2px]"
    :class="accentClass()"
    :style="positionStyle"
    aria-label="Facility cluster details"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      class="flex flex-col gap-[10px] rounded-sm bg-card p-[10px] shadow-sm"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <span
          class="text-xs font-semibold leading-none whitespace-nowrap"
          :class="accentTextClass()"
        >
          {{ perspectiveLabel() }}
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

      <!-- Body: donut chart + details -->
      <div class="flex items-start gap-[14px]">
        <!-- Donut Chart (stroke-based) -->
        <div class="relative flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
            <!-- Background ring -->
            <circle cx="34" cy="34" r="24" fill="none" stroke="var(--muted)" stroke-width="10" />
            <!-- Data segments -->
            <template v-for="(seg, i) in donutSegments()" :key="`cluster-${String(i)}`">
              <circle
                v-if="seg.path === null"
                cx="34"
                cy="34"
                r="24"
                fill="none"
                :stroke="seg.color"
                stroke-width="10"
                stroke-linecap="butt"
              />
              <path
                v-else
                :d="seg.path"
                fill="none"
                :stroke="seg.color"
                stroke-width="10"
                stroke-linecap="butt"
              />
            </template>
          </svg>
          <!-- Center text -->
          <div class="pointer-events-none absolute inset-0 grid place-items-center px-2">
            <span
              class="block max-w-[38px] text-center text-xs leading-none tracking-tight text-muted-foreground"
            >
              {{ formatMw(displayState.totalPowerMw) }}
            </span>
          </div>
        </div>

        <!-- Top Providers/Users -->
        <div class="flex flex-col gap-[6px]">
          <span class="text-xs font-semibold text-muted-foreground">{{ providerLabel() }}</span>
          <div class="flex flex-col gap-[6px]">
            <template v-for="(provider, i) in displayState.topProviders" :key="i">
              <div class="flex flex-col gap-[2px]">
                <span class="text-xs leading-none" :class="accentTextClass()">
                  {{ provider.name }}
                </span>
                <span class="text-xs leading-none text-muted-foreground">
                  Total Power: {{ formatMw(provider.totalPowerMw) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-xs">
        <template v-for="row in metricRows()" :key="row.label">
          <span class="text-muted-foreground">{{ row.label }}</span>
          <span class="text-right font-medium" :class="accentTextClass()">
            {{ formatMw(row.value) }}
          </span>
        </template>
      </div>

      <!-- Key -->
      <div class="flex items-center gap-[6px]">
        <div v-for="(segment, i) in pieSegments()" :key="i" class="flex items-center gap-[4px]">
          <span
            class="inline-block h-2 w-2 rounded-full"
            :style="{ backgroundColor: segment.color }"
          />
          <span class="text-xs text-muted-foreground">{{ segment.shortLabel }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-[6px]">
        <div
          role="button"
          tabindex="0"
          class="flex cursor-pointer items-center gap-0 opacity-60 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          @click="onZoomClick"
          @keydown.enter="onZoomClick"
          @keydown.space.prevent="onZoomClick"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="3.5" stroke="currentColor" stroke-width="1" fill="none" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="currentColor" stroke-width="1" />
            <line x1="5.5" y1="7" x2="8.5" y2="7" stroke="currentColor" stroke-width="0.7" />
            <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="currentColor" stroke-width="0.7" />
          </svg>
          <span class="text-xs text-muted-foreground">Zoom</span>
        </div>
        <div
          role="button"
          tabindex="0"
          class="flex cursor-pointer items-center gap-0 opacity-60 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
          @keydown.enter="() => {}"
          @keydown.space.prevent="() => {}"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 4L11 8L5 12Z" fill="currentColor" />
          </svg>
          <span class="text-xs text-muted-foreground">Select All</span>
        </div>
      </div>
    </div>
  </aside>
  </Transition>
</template>
