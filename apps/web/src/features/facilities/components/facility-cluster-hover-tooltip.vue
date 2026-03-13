<script setup lang="ts">
  import { ref, watch } from "vue";
  import type { FacilityClusterHoverState } from "@/features/facilities/hover.types";

  interface FacilityClusterHoverTooltipProps {
    readonly hoverState: FacilityClusterHoverState | null;
  }

  const props = defineProps<FacilityClusterHoverTooltipProps>();

  const isMouseOver = ref(false);
  const displayState = ref<FacilityClusterHoverState | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

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
    return displayState.value?.perspective === "hyperscale" ? "#10b981" : "#3b82f6";
  }

  function providerLabel(): string {
    return displayState.value?.perspective === "hyperscale" ? "Top Users" : "Top Providers";
  }

  interface DonutSegment {
    color: string;
    label: string;
    value: number;
  }

  function pieSegments(): DonutSegment[] {
    if (!displayState.value) {
      return [];
    }
    const isColo = displayState.value.perspective === "colocation";
    return [
      {
        color: isColo ? "#3b82f6" : "#10b981",
        label: isColo ? "Comm." : "Own.",
        value: displayState.value.commissionedPowerMw,
      },
      {
        color: isColo ? "#93c5fd" : "#6ee7b7",
        label: "UC",
        value: displayState.value.underConstructionPowerMw,
      },
      {
        color: isColo ? "#dbeafe" : "#d1fae5",
        label: "Plan.",
        value: displayState.value.plannedPowerMw,
      },
    ];
  }

  // Stroke-based donut segments: each is a <circle> with stroke-dasharray
  function donutCircles(): { color: string; dashArray: string; dashOffset: number }[] {
    const segments = pieSegments();
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
      return [];
    }

    const r = 24;
    const circumference = 2 * Math.PI * r;
    const circles: { color: string; dashArray: string; dashOffset: number }[] = [];
    let consumedLength = 0;

    for (const segment of segments) {
      if (segment.value <= 0) {
        continue;
      }
      const segmentLength = (segment.value / total) * circumference;
      circles.push({
        color: segment.color,
        dashArray: `${segmentLength} ${circumference - segmentLength}`,
        dashOffset: -consumedLength,
      });
      consumedLength += segmentLength;
    }

    return circles;
  }
</script>

<template>
  <aside
    v-if="displayState !== null"
    class="absolute z-30 rounded-[4px] p-[2px]"
    :style="{
      left: `${displayState.screenPoint[0] + 14}px`,
      top: `${displayState.screenPoint[1] + 14}px`,
      borderWidth: '0.5px',
      borderStyle: 'solid',
      borderColor: accentColor(),
    }"
    aria-label="Facility cluster details"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <div
      class="flex flex-col gap-[10px] rounded-[4px] bg-white p-[10px] shadow-[0_4px_8px_rgba(0,0,0,0.06)]"
    >
      <!-- Header -->
      <div class="flex items-center justify-between gap-3">
        <span
          class="text-[12px] font-semibold leading-none whitespace-nowrap"
          :style="{ color: accentColor() }"
        >
          {{ perspectiveLabel() }}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          class="flex-shrink-0 cursor-pointer opacity-40 hover:opacity-70"
        >
          <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="#94a3b8" stroke-width="1.2" />
          <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="#94a3b8" stroke-width="1.2" />
        </svg>
      </div>

      <!-- Body: donut chart + details -->
      <div class="flex items-start gap-[14px]">
        <!-- Donut Chart (stroke-based) -->
        <div class="relative flex-shrink-0">
          <svg width="68" height="68" viewBox="0 0 68 68">
            <!-- Background ring -->
            <circle cx="34" cy="34" r="24" fill="none" stroke="#f1f5f9" stroke-width="10" />
            <!-- Data segments -->
            <circle
              v-for="(seg, i) in donutCircles()"
              :key="i"
              cx="34"
              cy="34"
              r="24"
              fill="none"
              :stroke="seg.color"
              stroke-width="10"
              :stroke-dasharray="seg.dashArray"
              :stroke-dashoffset="seg.dashOffset"
              transform="rotate(-90 34 34)"
            />
          </svg>
          <!-- Center text -->
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-[8px] text-[#94a3b8]">{{ formatMw(displayState.totalPowerMw) }}</span>
          </div>
        </div>

        <!-- Top Providers/Users -->
        <div class="flex flex-col gap-[6px]">
          <span class="text-[10px] font-semibold text-[#94a3b8]">{{ providerLabel() }}</span>
          <div class="flex flex-col gap-[6px]">
            <template v-for="(provider, i) in displayState.topProviders" :key="i">
              <div class="flex flex-col gap-[2px]">
                <span class="text-[10px] leading-none" :style="{ color: accentColor() }">
                  {{ provider.name }}
                </span>
                <span class="text-[8px] leading-none text-[#94a3b8]">
                  Total Power: {{ formatMw(provider.totalPowerMw) }}
                </span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Key -->
      <div class="flex items-center gap-[6px]">
        <div v-for="(segment, i) in pieSegments()" :key="i" class="flex items-center gap-[4px]">
          <span
            class="inline-block size-[7px] rounded-full"
            :style="{ backgroundColor: segment.color }"
          />
          <span class="text-[8px] text-[#94a3b8]">{{ segment.label }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-[6px]">
        <div class="flex cursor-pointer items-center gap-0 opacity-60 hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <circle cx="7" cy="7" r="3.5" stroke="#94a3b8" stroke-width="1" fill="none" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke="#94a3b8" stroke-width="1" />
            <line x1="5.5" y1="7" x2="8.5" y2="7" stroke="#94a3b8" stroke-width="0.7" />
            <line x1="7" y1="5.5" x2="7" y2="8.5" stroke="#94a3b8" stroke-width="0.7" />
          </svg>
          <span class="text-[8px] text-[#94a3b8]">Zoom</span>
        </div>
        <div class="flex cursor-pointer items-center gap-0 opacity-60 hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 16 16">
            <path d="M5 4L11 8L5 12Z" fill="#94a3b8" />
          </svg>
          <span class="text-[8px] text-[#94a3b8]">Select All</span>
        </div>
      </div>
    </div>
  </aside>
</template>
