<script setup lang="ts">
  import { ChevronDown, ChevronUp } from "lucide-vue-next";
  import type { IMap } from "@map-migration/map-engine";
  import { computed, onMounted, onUnmounted, ref, watch } from "vue";
  import {
    buildFacilityPopupAddressText,
    buildFacilityPopupCodeText,
  } from "@/features/facilities/facility-popup.service";
  import type { FacilityHoverState } from "@/features/facilities/hover.types";
  import {
    type NearbyInfrastructureResult,
    queryNearbyInfrastructure,
  } from "@/features/facilities/nearby-infrastructure.service";
  import {
    type MarketDynamicsResult,
    queryMarketDynamics,
  } from "@/features/facilities/market-dynamics.service";
  import FacilityDonutChart from "@/features/facilities/components/facility-donut-chart.vue";
  import Slider from "@/components/ui/slider/slider.vue";
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

  // --- Accent styling ---

  const accentText = computed(() =>
    props.state.perspective === "hyperscale" ? "text-hyper-500" : "text-colo-500"
  );

  const accentBorder = computed(() =>
    props.state.perspective === "hyperscale" ? "border-hyper-500" : "border-colo-500"
  );

  const accentBg = computed(() =>
    props.state.perspective === "hyperscale" ? "bg-hyper-500" : "bg-colo-500"
  );

  // --- Header data ---

  const codeText = computed(() => {
    return buildFacilityPopupCodeText({
      facilityCode: props.state.facilityCode,
      providerName: props.state.providerName,
    });
  });

  const marketLine = computed(() => {
    return props.state.marketName ?? null;
  });

  const fullAddress = computed(() => {
    return buildFacilityPopupAddressText({
      address: props.state.address,
      city: props.state.city,
      facilityCode: props.state.facilityCode,
      facilityName: props.state.facilityName,
      providerName: props.state.providerName,
      stateAbbrev: props.state.stateAbbrev,
    });
  });

  // --- Metric cards ---

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

  // --- Tab state ---

  type TabId = "infrastructure" | "dynamics";
  const activeTab = ref<TabId>("infrastructure");

  // --- Nearby Infrastructure ---

  const infraResult = ref<NearbyInfrastructureResult | null>(null);
  const infraNoLayers = ref(false);
  const infraQueried = ref(false);

  let infraRetryTimer: ReturnType<typeof setTimeout> | null = null;
  let infraRetryCount = 0;
  const MAX_INFRA_RETRIES = 3;
  const INFRA_RETRY_DELAY_MS = 800;

  function queryInfrastructure(): void {
    infraNoLayers.value = false;
    infraQueried.value = false;
    const coords = props.state.coordinates;
    if (!(coords && props.map)) {
      infraNoLayers.value = true;
      return;
    }
    const result = queryNearbyInfrastructure(props.map, coords[0], coords[1]);
    if (result === null) {
      // Sources not loaded yet — schedule a retry so probe layers can trigger tile fetches
      if (infraRetryCount < MAX_INFRA_RETRIES) {
        infraRetryCount++;
        infraRetryTimer = setTimeout(queryInfrastructure, INFRA_RETRY_DELAY_MS);
        return;
      }
      infraNoLayers.value = true;
      return;
    }
    // If we got a result but all sections empty, retry once to wait for tiles
    const hasAny =
      result.substations.length > 0 ||
      result.powerPlants.length > 0 ||
      result.transmissionLines.length > 0 ||
      result.gasPipelines.length > 0 ||
      result.fiberRoutes.length > 0;
    if (!hasAny && infraRetryCount < MAX_INFRA_RETRIES) {
      infraRetryCount++;
      infraRetryTimer = setTimeout(queryInfrastructure, INFRA_RETRY_DELAY_MS);
      return;
    }
    infraResult.value = result;
    infraQueried.value = true;
  }

  onMounted(() => {
    queryInfrastructure();
  });

  onUnmounted(() => {
    if (infraRetryTimer !== null) {
      clearTimeout(infraRetryTimer);
    }
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

  // --- Market Dynamics ---

  const radiusValues = ref<number[]>([6]);
  const radiusMi = computed(() => radiusValues.value[0] ?? 6);

  const dynamicsResult = ref<MarketDynamicsResult | null>(null);

  function refreshDynamics(): void {
    const coords = props.state.coordinates;
    if (!(coords && props.map)) {
      dynamicsResult.value = null;
      return;
    }
    dynamicsResult.value = queryMarketDynamics(
      props.map,
      coords[0],
      coords[1],
      radiusMi.value,
      props.state.facilityId,
      props.state.marketName ?? null
    );
  }

  watch(activeTab, (tab) => {
    if (tab === "dynamics" && dynamicsResult.value === null) {
      refreshDynamics();
    }
  });

  watch(radiusValues, () => {
    if (activeTab.value === "dynamics") {
      refreshDynamics();
    }
  });

  // Collapsible sections
  const coloExpanded = ref(false);
  const hyperExpanded = ref(false);
  const facilitiesExpanded = ref(false);

  // --- Helpers ---

  function pctOfMarket(radiusVal: number, marketVal: number): string | null {
    if (marketVal <= 0) {
      return null;
    }
    const pct = (radiusVal / marketVal) * 100;
    return `${pct.toFixed(0)}% of Market Total`;
  }

  function formatPct(value: number | null): string {
    if (value === null) {
      return "-";
    }
    return `${value.toFixed(1)}%`;
  }

  function formatMw(value: number): string {
    if (value >= 100) {
      return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
    }
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} MW`;
  }

  function formatDist(value: number): string {
    return value.toFixed(2);
  }

  function onViewDetails(): void {
    emit("viewDetails", props.state.facilityId, props.state.perspective);
  }

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
              <svg width="8" height="10" viewBox="0 0 8 10" fill="none" aria-hidden="true">
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

        <!-- Underline Tabs -->
        <div class="flex items-center justify-center gap-6">
          <button
            type="button"
            class="pb-1 text-[14px] font-normal leading-none transition-colors"
            :class="
              activeTab === 'infrastructure'
                ? 'border-b border-[#2563eb] text-[#2563eb]'
                : 'text-[#94a3b8] hover:text-[#64748b]'
            "
            @click="activeTab = 'infrastructure'"
          >
            Nearby Infrastructure
          </button>
          <button
            type="button"
            class="pb-1 text-[14px] font-normal leading-none transition-colors"
            :class="
              activeTab === 'dynamics'
                ? 'border-b border-[#2563eb] text-[#2563eb]'
                : 'text-[#94a3b8] hover:text-[#64748b]'
            "
            @click="activeTab = 'dynamics'"
          >
            Market Dynamics
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex flex-col gap-4">
          <!-- ===== NEARBY INFRASTRUCTURE TAB ===== -->
          <template v-if="activeTab === 'infrastructure'">
            <!-- Infrastructure: no layers enabled -->
            <p
              v-if="infraNoLayers"
              class="max-w-[320px] text-[12px] font-normal leading-normal text-[#94a3b8]"
            >
              No nearby infrastructure data available for this location.
            </p>

            <!-- Infrastructure Sections -->
            <div
              v-else-if="infrastructureSections.length > 0"
              class="scrollbar-hide flex max-h-[200px] flex-col gap-2 overflow-y-auto rounded bg-[#f8fafc] p-3"
            >
              <div
                v-for="section in infrastructureSections"
                :key="section.label"
                class="flex flex-col gap-[4px]"
              >
                <span class="text-[12px] font-normal uppercase leading-normal text-[#94a3b8]">
                  {{ section.label }}
                </span>
                <div class="flex flex-col">
                  <span
                    v-for="item in section.items"
                    :key="item.label"
                    class="text-[12px] font-normal leading-relaxed text-[#94a3b8]"
                  >
                    <span class="font-semibold">{{ item.distance }}</span>
                    - {{ item.label }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Infrastructure: layers enabled but nothing within 25km -->
            <p
              v-else-if="infraQueried && infrastructureSections.length === 0"
              class="text-[12px] font-normal leading-normal text-[#94a3b8]"
            >
              No infrastructure found within 25 km.
            </p>
          </template>

          <!-- ===== MARKET DYNAMICS TAB ===== -->
          <template v-if="activeTab === 'dynamics'">
            <div class="flex flex-col gap-[28px] rounded bg-[#f8fafc] p-[14px]">
              <!-- Radius Slider -->
              <div class="flex items-center gap-4">
                <span class="shrink-0 text-[11px] font-semibold text-[#94a3b8]">
                  Radius (mi)
                </span>
                <div class="flex flex-1 items-center gap-2">
                  <Slider v-model="radiusValues" :min="1" :max="15" :step="1" class="flex-1" />
                  <span
                    class="flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] bg-[#94a3b8] px-[3px] text-[8px] font-semibold text-[#f8fafc] shadow-sm"
                  >
                    {{ radiusMi }}
                  </span>
                </div>
              </div>

              <template v-if="dynamicsResult">
                <!-- Colocation Section -->
                <div class="flex flex-col gap-[21px]">
                  <div class="flex flex-col gap-[7px]">
                    <button
                      type="button"
                      class="flex items-center gap-1 text-[11px] font-semibold text-[#94a3b8]"
                      @click="coloExpanded = !coloExpanded"
                    >
                      Colocation
                      <component :is="coloExpanded ? ChevronUp : ChevronDown" class="size-3" />
                    </button>

                    <template v-if="coloExpanded">
                      <!-- Metric Cards row -->
                      <div class="flex gap-[7px]">
                        <!-- Comm -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketColocation
                              ? pctOfMarket(dynamicsResult.colocation.commissionedMw, dynamicsResult.marketColocation.commissionedMw) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#3b82f6] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Comm.</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ formatMw(dynamicsResult.colocation.commissionedMw) }}</span>
                          </div>
                        </div>
                        <!-- Pipeline -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketColocation
                              ? pctOfMarket(dynamicsResult.colocation.pipelineMw, dynamicsResult.marketColocation.pipelineMw) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#3b82f6] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Pipeline</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ formatMw(dynamicsResult.colocation.pipelineMw) }}</span>
                          </div>
                        </div>
                        <!-- Vacancy -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketColocation && dynamicsResult.marketColocation.vacancyPct !== null
                              ? `Market Vac: ${formatPct(dynamicsResult.marketColocation.vacancyPct)}`
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#3b82f6] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Vacancy</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ formatPct(dynamicsResult.colocation.vacancyPct) }}</span>
                          </div>
                        </div>
                        <!-- Facilities -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketColocation
                              ? pctOfMarket(dynamicsResult.colocation.facilityCount, dynamicsResult.marketColocation.facilityCount) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#3b82f6] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Facilities</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ dynamicsResult.colocation.facilityCount }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- Donut Charts (outside the title+metrics group, sibling at 21px gap) -->
                  <div
                    v-if="coloExpanded && (
                      dynamicsResult.colocationCommDonut.segments.length > 0 ||
                      dynamicsResult.colocationPipelineDonut.segments.length > 0
                    )"
                    class="flex items-start justify-between"
                  >
                    <div
                      v-if="dynamicsResult.colocationCommDonut.segments.length > 0"
                      class="flex flex-col items-start gap-[14px]"
                    >
                      <span class="text-[10px] font-normal text-[#94a3b8]">Comm. by Provider</span>
                      <FacilityDonutChart
                        :segments="dynamicsResult.colocationCommDonut.segments"
                        :size="96"
                      />
                    </div>
                    <div
                      v-if="dynamicsResult.colocationPipelineDonut.segments.length > 0"
                      class="flex flex-col items-start gap-[14px]"
                    >
                      <span class="text-[10px] font-normal text-[#94a3b8]">Pipeline by Provider</span>
                      <FacilityDonutChart
                        :segments="dynamicsResult.colocationPipelineDonut.segments"
                        :size="96"
                      />
                    </div>
                  </div>
                </div>

                <!-- Hyperscale Section -->
                <div class="flex flex-col gap-[21px]">
                  <div class="flex flex-col gap-[7px]">
                    <button
                      type="button"
                      class="flex items-center gap-1 text-[11px] font-semibold text-[#94a3b8]"
                      @click="hyperExpanded = !hyperExpanded"
                    >
                      Hyperscale
                      <component :is="hyperExpanded ? ChevronUp : ChevronDown" class="size-3" />
                    </button>

                    <template v-if="hyperExpanded">
                      <!-- Metric Cards row -->
                      <div class="flex gap-[7px]">
                        <!-- Owned -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketHyperscale
                              ? pctOfMarket(dynamicsResult.hyperscale.commissionedMw, dynamicsResult.marketHyperscale.commissionedMw) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#10b981] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Owned</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ formatMw(dynamicsResult.hyperscale.commissionedMw) }}</span>
                          </div>
                        </div>
                        <!-- Pipeline -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketHyperscale
                              ? pctOfMarket(dynamicsResult.hyperscale.pipelineMw, dynamicsResult.marketHyperscale.pipelineMw) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#10b981] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Pipeline</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ formatMw(dynamicsResult.hyperscale.pipelineMw) }}</span>
                          </div>
                        </div>
                        <!-- Facilities -->
                        <div class="flex flex-col gap-[7px]">
                          <span class="h-[10px] text-[7px] leading-tight text-[#94a3b8]">{{
                            dynamicsResult.hasMarket && dynamicsResult.marketHyperscale
                              ? pctOfMarket(dynamicsResult.hyperscale.facilityCount, dynamicsResult.marketHyperscale.facilityCount) ?? ""
                              : ""
                          }}</span>
                          <div class="flex flex-col gap-[3px] rounded bg-[#10b981] p-[7px]">
                            <span class="text-[10px] font-normal leading-tight text-white">Facilities</span>
                            <span class="text-[10px] font-semibold leading-tight text-white">{{ dynamicsResult.hyperscale.facilityCount }}</span>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>

                  <!-- Donut Charts -->
                  <div
                    v-if="hyperExpanded && (
                      dynamicsResult.hyperscaleCommDonut.segments.length > 0 ||
                      dynamicsResult.hyperscalePipelineDonut.segments.length > 0
                    )"
                    class="flex items-start justify-between"
                  >
                    <div
                      v-if="dynamicsResult.hyperscaleCommDonut.segments.length > 0"
                      class="flex flex-col items-start gap-[14px]"
                    >
                      <span class="text-[10px] font-normal text-[#94a3b8]">Owned by User</span>
                      <FacilityDonutChart
                        :segments="dynamicsResult.hyperscaleCommDonut.segments"
                        :size="96"
                      />
                    </div>
                    <div
                      v-if="dynamicsResult.hyperscalePipelineDonut.segments.length > 0"
                      class="flex flex-col items-start gap-[14px]"
                    >
                      <span class="text-[10px] font-normal text-[#94a3b8]">Pipeline by User</span>
                      <FacilityDonutChart
                        :segments="dynamicsResult.hyperscalePipelineDonut.segments"
                        :size="96"
                      />
                    </div>
                  </div>
                </div>

                <!-- Facilities in Radius Section -->
                <div class="flex flex-col gap-[14px]">
                  <button
                    type="button"
                    class="flex items-center gap-1 text-[11px] font-semibold text-[#94a3b8]"
                    @click="facilitiesExpanded = !facilitiesExpanded"
                  >
                    Facilities in Radius
                    <component
                      :is="facilitiesExpanded ? ChevronUp : ChevronDown"
                      class="size-3"
                    />
                  </button>

                  <template v-if="facilitiesExpanded">
                    <div
                      v-if="dynamicsResult.facilitiesInRadius.length === 0"
                      class="text-[9px] text-[#94a3b8]"
                    >
                      No facilities found within {{ radiusMi }} mi.
                    </div>
                    <div v-else class="flex flex-col gap-[14px]">
                      <!-- Table Header -->
                      <div
                        class="grid grid-cols-[1fr_70px_56px_56px] gap-x-1 text-[7px] font-normal uppercase text-[#94a3b8]"
                      >
                        <span>Company</span>
                        <span class="text-right">Comm./Own. (MW)</span>
                        <span class="text-right">Pipeline (MW)</span>
                        <span class="text-right">Distance (mi)</span>
                      </div>
                      <!-- Table Rows -->
                      <div class="flex flex-col gap-[7px]">
                        <div
                          v-for="(row, i) in dynamicsResult.facilitiesInRadius"
                          :key="i"
                          class="grid grid-cols-[1fr_70px_56px_56px] items-center gap-x-1 text-[9px] leading-tight text-[#94a3b8]"
                        >
                          <div class="flex items-center gap-[3px] truncate">
                            <span
                              class="inline-block size-[7px] shrink-0 rounded-full"
                              :class="
                                row.perspective === 'colocation'
                                  ? 'bg-[#3b82f6]'
                                  : 'bg-[#10b981]'
                              "
                            />
                            <span class="truncate">{{ row.providerName }}</span>
                          </div>
                          <span class="text-right">
                            {{ row.commOrOwnMw > 0 ? row.commOrOwnMw.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-" }}
                          </span>
                          <span class="text-right">
                            {{ row.pipelineMw > 0 ? row.pipelineMw.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "-" }}
                          </span>
                          <span class="text-right">{{ formatDist(row.distanceMi) }}</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </template>

          <!-- View Details -->
          <button
            type="button"
            class="flex items-center gap-2 px-2 hover:underline"
            :class="accentText"
            @click="onViewDetails"
          >
            <span class="text-[16px] font-normal leading-none">View Details</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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
