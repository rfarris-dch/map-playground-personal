<script setup lang="ts">
  import { arc as d3Arc, pie as d3Pie } from "d3-shape";
  import { computed, ref } from "vue";
  import type { ProviderSegment } from "@/features/facilities/market-dynamics.service";

  interface Props {
    readonly segments: readonly ProviderSegment[];
    readonly size?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    size: 64,
  });

  const hoveredIndex = ref<number | null>(null);
  const center = computed(() => props.size / 2);
  const radius = computed(() => props.size / 2 - 1);

  const pieGen = d3Pie<ProviderSegment>()
    .value((d) => d.valueMw)
    .sort(null)
    .padAngle(0.04);

  const arcGen = computed(() =>
    d3Arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(0)
      .outerRadius(radius.value)
  );

  interface SliceData {
    readonly color: string;
    readonly d: string;
    readonly index: number;
  }

  const slices = computed<SliceData[]>(() => {
    const visible = props.segments.filter((s) => s.valueMw > 0);
    if (visible.length === 0) {
      return [];
    }

    const arcs = pieGen(visible as ProviderSegment[]);
    const gen = arcGen.value;

    return arcs.map((a, i) => ({
      color: visible[i]!.color,
      d: gen(a) ?? "",
      index: i,
    }));
  });

  const hoveredSegment = computed(() => {
    if (hoveredIndex.value === null) {
      return null;
    }
    const visible = props.segments.filter((s) => s.valueMw > 0);
    return visible[hoveredIndex.value] ?? null;
  });

  function onEnter(index: number): void {
    hoveredIndex.value = index;
  }

  function onLeave(): void {
    hoveredIndex.value = null;
  }

  function formatPct(value: number): string {
    return `${value.toFixed(0)}%`;
  }

  function formatMw(value: number): string {
    if (value >= 100) {
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  }
</script>

<template>
  <div class="relative inline-block">
    <svg
      :width="props.size"
      :height="props.size"
      :viewBox="`0 0 ${props.size} ${props.size}`"
    >
      <g :transform="`translate(${center}, ${center})`">
        <!-- Background circle -->
        <circle :r="radius" fill="#e2e8f0" />
        <!-- Pie slices -->
        <path
          v-for="slice in slices"
          :key="slice.index"
          :d="slice.d"
          :fill="slice.color"
          stroke="white"
          stroke-width="1"
          class="cursor-pointer transition-opacity"
          :opacity="hoveredIndex !== null && hoveredIndex !== slice.index ? 0.35 : 1"
          @mouseenter="onEnter(slice.index)"
          @mouseleave="onLeave"
        />
      </g>
    </svg>
    <!-- Hover tooltip -->
    <Transition enter-active-class="transition-opacity duration-75" enter-from-class="opacity-0">
      <div
        v-if="hoveredSegment"
        class="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-[10px] leading-tight text-white shadow-md"
      >
        <div class="flex items-center gap-1">
          <span
            class="inline-block size-[6px] rounded-full"
            :style="{ backgroundColor: hoveredSegment.color }"
          />
          <span class="font-medium">{{ hoveredSegment.label }}</span>
        </div>
        <div class="text-slate-300">
          {{ formatPct(hoveredSegment.pct) }} &middot; {{ formatMw(hoveredSegment.valueMw) }}
        </div>
      </div>
    </Transition>
  </div>
</template>
