<script setup lang="ts">
  import type { IMap } from "@map-migration/map-engine";
  import { computed, ref, watch } from "vue";
  import type { FacilityHoverState } from "@/features/facilities/hover.types";
  import {
    type NearbyInfrastructureResult,
    queryNearbyInfrastructure,
  } from "@/features/facilities/nearby-infrastructure.service";
  import { formatMegawatts } from "@/lib/power-format.service";

  interface Props {
    readonly map: IMap | null;
    readonly state: FacilityHoverState;
  }

  const emit = defineEmits<{
    close: [];
    viewDetails: [facilityId: string, perspective: string];
  }>();

  const props = defineProps<Props>();

  const accentText = computed(() =>
    props.state.perspective === "hyperscale" ? "text-hyper-500" : "text-colo-500"
  );

  const accentBorder = computed(() =>
    props.state.perspective === "hyperscale" ? "border-hyper-500" : "border-colo-500"
  );

  const accentBg = computed(() =>
    props.state.perspective === "hyperscale" ? "bg-hyper-500" : "bg-colo-500"
  );

  const codeText = computed(() => {
    const code = props.state.facilityCode;
    if (code === null || code.toLowerCase() === "null") {
      return null;
    }
    if (code.toLowerCase() === props.state.providerName.toLowerCase()) {
      return null;
    }
    return code;
  });

  const marketLine = computed(() => {
    return props.state.marketName ?? null;
  });

  const fullAddress = computed(() => {
    const parts: string[] = [];
    if (props.state.address) {
      parts.push(props.state.address);
    }
    if (props.state.city) {
      parts.push(props.state.city);
    }
    if (props.state.stateAbbrev) {
      parts.push(props.state.stateAbbrev);
    }
    if (parts.length === 0 && props.state.facilityName) {
      return props.state.facilityName;
    }
    return parts.join(", ") || null;
  });

  interface Metric {
    readonly label: string;
    readonly value: string;
  }

  const metrics = computed<Metric[]>(() => {
    const s = props.state;
    const result: Metric[] = [];

    if (s.commissionedPowerMw !== null) {
      result.push({ label: "Comm.", value: formatMegawatts(s.commissionedPowerMw) });
    }
    if (s.underConstructionPowerMw !== null) {
      result.push({ label: "UC", value: formatMegawatts(s.underConstructionPowerMw) });
    }
    if (s.plannedPowerMw !== null) {
      result.push({ label: "Plan.", value: formatMegawatts(s.plannedPowerMw) });
    }
    if (s.availablePowerMw !== null) {
      result.push({ label: "Avail.", value: formatMegawatts(s.availablePowerMw) });
    }

    return result;
  });

  function onViewDetails(): void {
    emit("viewDetails", props.state.facilityId, props.state.perspective);
  }

  const nearbyInfrastructure = ref(false);

  const infraResult = ref<NearbyInfrastructureResult | null>(null);
  const infraNoLayers = ref(false);

  const infraQueried = ref(false);

  watch(nearbyInfrastructure, (on) => {
    if (!on) {
      return;
    }
    infraResult.value = null;
    infraNoLayers.value = false;
    infraQueried.value = false;
    const coords = props.state.coordinates;
    if (!(coords && props.map)) {
      infraNoLayers.value = true;
      return;
    }
    const result = queryNearbyInfrastructure(props.map, coords[0], coords[1]);
    if (result === null) {
      infraNoLayers.value = true;
      return;
    }
    infraResult.value = result;
    infraQueried.value = true;
  });

  interface InfrastructureSection {
    readonly items: readonly { label: string; distance: string }[];
    readonly label: string;
  }

  const infrastructureSections = computed<InfrastructureSection[]>(() => {
    const r = infraResult.value;
    if (!r) {
      return [];
    }
    const sections: InfrastructureSection[] = [];
    if (r.substations.length > 0) {
      sections.push({ label: "SUBSTATIONS", items: r.substations });
    }
    if (r.powerPlants.length > 0) {
      sections.push({ label: "POWER PLANTS", items: r.powerPlants });
    }
    if (r.transmissionLines.length > 0) {
      sections.push({ label: "TRANSMISSION LINES", items: r.transmissionLines });
    }
    if (r.gasPipelines.length > 0) {
      sections.push({ label: "GAS PIPELINES", items: r.gasPipelines });
    }
    if (r.fiberRoutes.length > 0) {
      sections.push({ label: "FIBER", items: r.fiberRoutes });
    }
    return sections;
  });

  const toggleBgClass = computed(() => {
    if (!nearbyInfrastructure.value) {
      return "bg-[#cbd5e1]";
    }
    return props.state.perspective === "hyperscale" ? "bg-hyper-500" : "bg-colo-500";
  });

  function onClose(): void {
    emit("close");
  }
</script>

<template>
  <Transition enter-active-class="transition-opacity duration-100" enter-from-class="opacity-0">
    <aside
      class="pointer-events-auto fixed right-[52px] top-[120px] z-30 flex flex-col items-start rounded-[8px] border-2 border-solid bg-white shadow-md"
      :class="accentBorder"
      aria-label="Facility details"
    >
      <div class="flex min-w-[376px] flex-col gap-4 p-4">
        <!-- Top Section -->
        <div class="flex flex-col gap-2">
          <!-- Title row -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-wrap items-center gap-2 leading-none">
              <span class="text-[20px] font-semibold whitespace-nowrap" :class="accentText">
                {{ state.providerName }}
              </span>
              <span
                v-if="codeText"
                class="text-[16px] font-normal whitespace-nowrap text-[#94a3b8]"
              >
                {{ codeText }}
              </span>
            </div>
            <button
              type="button"
              class="mt-1 flex size-6 shrink-0 items-center justify-center opacity-40 hover:opacity-80"
              aria-label="Close"
              @click="onClose"
            >
              <svg width="8" height="10" viewBox="0 0 8 10" fill="none">
                <line x1="1" y1="1" x2="7" y2="9" stroke="currentColor" stroke-width="1.2" />
                <line x1="7" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.2" />
              </svg>
            </button>
          </div>

          <!-- Market + Address -->
          <div class="flex flex-col">
            <span
              v-if="marketLine"
              class="text-[16px] font-normal leading-normal"
              :class="accentText"
            >
              {{ marketLine }}
            </span>
            <span v-if="fullAddress" class="text-[16px] font-normal leading-normal text-[#94a3b8]">
              {{ fullAddress }}
            </span>
          </div>
        </div>

        <!-- Metric Cards -->
        <div v-if="metrics.length > 0" class="flex flex-wrap justify-start gap-2">
          <div
            v-for="metric in metrics"
            :key="metric.label"
            class="flex w-[80px] flex-col items-start gap-[4px] rounded-[8px] p-2"
            :class="accentBg"
          >
            <span class="text-[16px] font-normal leading-none whitespace-nowrap text-white">
              {{ metric.label }}
            </span>
            <span class="text-[16px] font-semibold leading-none whitespace-nowrap text-white">
              {{ metric.value }}
            </span>
          </div>
        </div>

        <!-- Bottom Section -->
        <div class="flex flex-col gap-6">
          <!-- Nearby Infrastructure toggle -->
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <!-- Power transmission tower icon -->
              <svg class="text-[#94a3b8]" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1v14M5 4h6M4.5 7h7M3 15l5-8 5 8M6 1l2 3 2-3"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span class="text-[16px] font-normal leading-none text-[#94a3b8]">
                Nearby Infrastructure
              </span>
            </div>
            <button
              type="button"
              class="relative h-[16px] w-[32px] rounded-full transition-colors"
              :class="toggleBgClass"
              @click="nearbyInfrastructure = !nearbyInfrastructure"
            >
              <span
                class="absolute top-[2px] size-[12px] rounded-full bg-white shadow-sm transition-transform"
                :class="nearbyInfrastructure ? 'left-[18px]' : 'left-[2px]'"
              />
            </button>
          </div>

          <!-- Infrastructure: no layers enabled -->
          <p
            v-if="nearbyInfrastructure && infraNoLayers"
            class="max-w-[320px] text-[12px] font-normal leading-normal text-[#94a3b8]"
          >
            Enable infrastructure layers to view nearby infrastructure.
          </p>

          <!-- Infrastructure Sections (expanded) -->
          <div
            v-else-if="nearbyInfrastructure && infrastructureSections.length > 0"
            class="scrollbar-hide flex max-h-[200px] flex-col gap-2 overflow-y-auto"
          >
            <div
              v-for="section in infrastructureSections"
              :key="section.label"
              class="flex flex-col gap-[4px]"
            >
              <span
                class="pl-2 text-[12px] font-normal uppercase leading-normal"
                :class="accentText"
              >
                {{ section.label }}
              </span>
              <div class="flex flex-col pl-4">
                <span
                  v-for="item in section.items"
                  :key="item.label"
                  class="text-[12px] font-normal leading-normal text-[#94a3b8]"
                >
                  {{ item.label }}
                  - {{ item.distance }}
                </span>
              </div>
            </div>
          </div>

          <!-- Infrastructure: layers enabled but nothing within 25km -->
          <p
            v-else-if="nearbyInfrastructure && infraQueried && infrastructureSections.length === 0"
            class="text-[12px] font-normal leading-normal text-[#94a3b8]"
          >
            No infrastructure found within 25 km.
          </p>

          <!-- View Details -->
          <button
            type="button"
            class="flex items-center gap-2 px-2 hover:underline"
            :class="accentText"
            @click="onViewDetails"
          >
            <span class="text-[16px] font-normal leading-none">View Details</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 4l4 4-4 4"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>
