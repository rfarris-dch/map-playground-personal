<script setup lang="ts">
  import { computed } from "vue";
  import { buildFacilityClusterPowerSegments } from "@/features/facilities/facilities-cluster.service";
  import type { FacilityClusterHoverState } from "@/features/facilities/hover.types";
  import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface Props {
    readonly state: FacilityClusterHoverState;
  }

  const emit = defineEmits<{
    close: [];
    zoomToCluster: [
      perspective: FacilityClusterHoverState["perspective"],
      clusterId: number,
      center: readonly [number, number],
    ];
  }>();

  const props = defineProps<Props>();

  const accentText = computed(() =>
    props.state.perspective === "hyperscale" ? "text-hyper-500" : "text-colo-500"
  );

  const accentBorder = computed(() =>
    props.state.perspective === "hyperscale" ? "border-hyper-500" : "border-colo-500"
  );

  const titleLine = computed(() => {
    const count = props.state.topProviders.length;
    if (props.state.perspective === "hyperscale") {
      return `${count} Hyperscale Users`;
    }
    return `${count} Colocation Providers`;
  });

  const providerLabel = computed(() =>
    props.state.perspective === "hyperscale" ? "Top Users" : "Top Providers"
  );

  const donutSegments = computed(() =>
    buildDonutChartArcSegments({
      centerX: 68,
      centerY: 68,
      radius: 48,
      segments: buildFacilityClusterPowerSegments(props.state),
    })
  );

  const powerSegments = computed(() => buildFacilityClusterPowerSegments(props.state));

  function onClose(): void {
    emit("close");
  }

  function onZoom(): void {
    emit("zoomToCluster", props.state.perspective, props.state.clusterId, props.state.center);
  }
</script>

<template>
  <Transition enter-active-class="transition-opacity duration-100" enter-from-class="opacity-0">
    <aside
      class="pointer-events-auto fixed right-[52px] top-[120px] z-30 flex flex-col items-start rounded-[8px] border-2 border-solid bg-white shadow-md"
      :class="accentBorder"
      aria-label="Cluster details"
    >
      <div class="flex min-w-[376px] flex-col gap-4 p-4">
        <!-- Title + Close -->
        <div class="flex items-center justify-between">
          <span class="text-[20px] font-semibold leading-none" :class="accentText">
            {{ titleLine }}
          </span>
          <button
            type="button"
            class="mt-1 flex size-6 shrink-0 items-center justify-center opacity-40 hover:opacity-80"
            aria-label="Close"
            @click="onClose"
          >
            <svg width="8" height="10" viewBox="0 0 8 10" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="7" y2="9" stroke="currentColor" stroke-width="1.2" />
              <line x1="7" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2" />
            </svg>
          </button>
        </div>

        <!-- Chart + Providers -->
        <div class="flex items-start gap-6 px-2">
          <!-- Donut Chart -->
          <div class="relative shrink-0">
            <svg width="136" height="136" viewBox="0 0 136 136" aria-hidden="true">
              <circle cx="68" cy="68" r="48" fill="none" stroke="var(--muted)" stroke-width="20" />
              <template v-for="(segment, index) in donutSegments" :key="`seg-${String(index)}`">
                <circle
                  v-if="segment.path === null"
                  cx="68"
                  cy="68"
                  r="48"
                  fill="none"
                  :stroke="segment.color"
                  stroke-width="20"
                  stroke-linecap="butt"
                />
                <path
                  v-else
                  :d="segment.path"
                  fill="none"
                  :stroke="segment.color"
                  stroke-width="20"
                  stroke-linecap="butt"
                />
              </template>
            </svg>
            <div class="pointer-events-none absolute inset-0 grid place-items-center">
              <span class="text-[12px] leading-none text-[#94a3b8]">
                {{ formatMegawatts(state.totalPowerMw) }}
              </span>
            </div>
          </div>

          <!-- Top Providers -->
          <div class="flex flex-col gap-2">
            <span class="text-[16px] font-semibold text-[#94a3b8]">{{ providerLabel }}</span>
            <div class="flex flex-col gap-2">
              <div
                v-for="provider in state.topProviders"
                :key="provider.name"
                class="flex flex-col"
              >
                <span class="text-[16px] font-normal leading-normal" :class="accentText">
                  {{ provider.name }}
                </span>
                <span class="text-[12px] font-normal leading-normal text-[#94a3b8]">
                  Total Power: {{ formatMegawatts(provider.totalPowerMw) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="flex items-center gap-4">
          <div
            v-for="segment in powerSegments"
            :key="segment.shortLabel"
            class="flex items-center gap-1"
          >
            <span
              class="inline-block size-[12px] rounded-full"
              :style="{ backgroundColor: segment.color }"
            />
            <span class="text-[12px] font-normal text-[#94a3b8]"> {{ segment.shortLabel }} </span>
          </div>
        </div>

        <!-- Jump to Selection -->
        <button
          type="button"
          class="flex items-center gap-2 hover:underline"
          :class="accentText"
          @click="onZoom"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            class="text-[#94a3b8]"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.2" fill="none" />
            <line
              x1="10"
              y1="10"
              x2="13"
              y2="13"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
            <line
              x1="5"
              y1="7"
              x2="9"
              y2="7"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
            />
            <line
              x1="7"
              y1="5"
              x2="7"
              y2="9"
              stroke="currentColor"
              stroke-width="1"
              stroke-linecap="round"
            />
          </svg>
          <span class="text-[16px] font-normal leading-none text-[#94a3b8]">Jump to Selection</span>
        </button>
      </div>
    </aside>
  </Transition>
</template>
