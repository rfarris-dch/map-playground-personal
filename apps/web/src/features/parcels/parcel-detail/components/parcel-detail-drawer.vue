<script setup lang="ts">
  import { ChevronDown, ChevronUp, Copy, Info, X } from "lucide-vue-next";
  import type { IMap } from "@map-migration/map-engine";
  import { computed, onMounted, onUnmounted, ref, watch } from "vue";
  import type { ParcelDetailPayload } from "@/features/parcels/parcel-detail/detail.types";
  import type { SelectedParcelRef } from "@/features/parcels/parcels.types";
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

  interface ParcelDetailDrawerProps {
    readonly detail: ParcelDetailPayload | null;
    readonly isError: boolean;
    readonly isLoading: boolean;
    readonly map: IMap | null;
    readonly selectedParcel: SelectedParcelRef | null;
  }

  const props = defineProps<ParcelDetailDrawerProps>();

  const emit = defineEmits<{
    close: [];
  }>();

  // --- Attribute reader ---

  function readAttr(attrs: Record<string, unknown>, key: string): string | null {
    const val = attrs[key];
    if (val === null || val === undefined || val === "") return null;
    return String(val);
  }

  // --- Computed data ---

  const attrs = computed<Record<string, unknown>>(() => {
    if (props.detail === null) return {};
    return props.detail.response.feature.properties.attrs;
  });

  const hasAddress = computed(() => readAttr(attrs.value, "address") !== null);

  const titleText = computed(() => {
    const a = attrs.value;
    if (hasAddress.value) {
      const parts: string[] = [];
      const address = readAttr(a, "address");
      if (address !== null) parts.push(address);
      const city = readAttr(a, "situs_city");
      const state = readAttr(a, "situs_state");
      const cityState = [city, state].filter((v) => v !== null).join(", ");
      if (cityState.length > 0) parts.push(cityState);
      return parts.join(", ");
    }
    return readAttr(a, "parcelnumb") ?? readAttr(a, "parcelnumb_no_formatting") ?? "Unknown Parcel";
  });

  const titleSubtext = computed(() => {
    return hasAddress.value ? "Address" : "Assessor Parcel Number";
  });

  const apn = computed(() => {
    return readAttr(attrs.value, "parcelnumb") ?? readAttr(attrs.value, "parcelnumb_no_formatting");
  });

  const owner = computed(() => readAttr(attrs.value, "owner"));

  const zone = computed(() => readAttr(attrs.value, "zoning_type"));
  const zoneSubtype = computed(() => readAttr(attrs.value, "zoning_subtype"));
  const sizeAcres = computed(() => readAttr(attrs.value, "ll_gisacre"));
  const roughnessRating = computed(() => readAttr(attrs.value, "roughness_rating"));

  // --- Copy to clipboard ---

  const copySuccess = ref(false);

  function copyOwner(): void {
    const ownerValue = owner.value;
    if (ownerValue === null) return;
    navigator.clipboard.writeText(ownerValue).then(() => {
      copySuccess.value = true;
      setTimeout(() => {
        copySuccess.value = false;
      }, 1500);
    });
  }

  // --- Roughness tooltip ---

  const showRoughnessTooltip = ref(false);

  // --- Tab state ---

  type TabId = "summary" | "infrastructure" | "dynamics";
  const activeTab = ref<TabId>("summary");

  // --- Parcel Summary fields ---

  interface SummaryField {
    readonly label: string;
    readonly value: string | null;
  }

  interface SummarySection {
    readonly fields: readonly SummaryField[];
    readonly title: string;
  }

  const summarySections = computed<SummarySection[]>(() => {
    const a = attrs.value;
    return [
      {
        title: "LOCATION & IDENTIFICATION",
        fields: [
          { label: "Address", value: readAttr(a, "address") },
          { label: "City", value: readAttr(a, "situs_city") },
          { label: "County", value: readAttr(a, "situs_county") },
          { label: "State", value: readAttr(a, "situs_state") },
          { label: "ZIP", value: readAttr(a, "situs_zip") },
          { label: "Latitude", value: readAttr(a, "lat") },
          { label: "Longitude", value: readAttr(a, "lon") },
          { label: "Assessor Parcel Number", value: apn.value },
          { label: "Tax ID", value: readAttr(a, "tax_id") },
        ],
      },
      {
        title: "PARCEL CHARACTERISTICS",
        fields: [
          { label: "Size", value: sizeAcres.value !== null ? `${sizeAcres.value} acres` : null },
          { label: "Structure on Parcel", value: readAttr(a, "ll_bldg_footprint_sqft") !== null ? `${readAttr(a, "ll_bldg_footprint_sqft")} sq ft` : null },
          { label: "Building Count", value: readAttr(a, "ll_bldg_count") },
          { label: "Highest Parcel Elevation", value: readAttr(a, "elevation_max_m") !== null ? `${readAttr(a, "elevation_max_m")} m` : null },
          { label: "Lowest Parcel Elevation", value: readAttr(a, "elevation_min_m") !== null ? `${readAttr(a, "elevation_min_m")} m` : null },
          { label: "Roughness Rating", value: roughnessRating.value },
        ],
      },
      {
        title: "ZONING & LAND USE",
        fields: [
          { label: "Zoning Code", value: readAttr(a, "zoning") },
          { label: "Zoning Code Detail", value: readAttr(a, "zoning_type") },
          { label: "Zone", value: zone.value },
          { label: "Zone Subtype", value: zoneSubtype.value },
        ],
      },
      {
        title: "DEMOGRAPHICS & GROWTH POTENTIAL",
        fields: [
          { label: "Population Density", value: readAttr(a, "pop_density") },
          { label: "5 Year Population Forecast", value: readAttr(a, "pop_forecast_5yr") },
          { label: "5 Year Population Growth", value: readAttr(a, "pop_growth_5yr") },
        ],
      },
      {
        title: "OWNERSHIP & HISTORY",
        fields: [
          { label: "Owner", value: owner.value },
          { label: "Last Sale Date", value: readAttr(a, "last_sale_date") },
          { label: "Last Sale Price", value: readAttr(a, "last_sale_price") !== null ? `$${Number(readAttr(a, "last_sale_price")).toLocaleString()}` : null },
        ],
      },
    ];
  });

  // --- Coordinates for infrastructure/dynamics queries ---

  const parcelCoords = computed<readonly [number, number] | null>(() => {
    const a = attrs.value;
    const lonStr = readAttr(a, "lon");
    const latStr = readAttr(a, "lat");
    if (lonStr === null || latStr === null) return null;
    const lng = Number(lonStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat] as const;
  });

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
    const coords = parcelCoords.value;
    if (!(coords && props.map)) {
      infraNoLayers.value = true;
      return;
    }
    const result = queryNearbyInfrastructure(props.map, coords[0], coords[1]);
    if (result === null) {
      if (infraRetryCount < MAX_INFRA_RETRIES) {
        infraRetryCount++;
        infraRetryTimer = setTimeout(queryInfrastructure, INFRA_RETRY_DELAY_MS);
        return;
      }
      infraNoLayers.value = true;
      return;
    }
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

  interface InfrastructureSection {
    readonly items: readonly { label: string; distance: string }[];
    readonly label: string;
  }

  const infrastructureSections = computed<InfrastructureSection[]>(() => {
    const r = infraResult.value;
    if (!r) return [];
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
    const coords = parcelCoords.value;
    if (!(coords && props.map)) {
      dynamicsResult.value = null;
      return;
    }
    dynamicsResult.value = queryMarketDynamics(
      props.map,
      coords[0],
      coords[1],
      radiusMi.value,
      "",
      null,
    );
  }

  const coloExpanded = ref(false);
  const hyperExpanded = ref(false);
  const facilitiesExpanded = ref(false);

  // --- Tab watchers ---

  watch(activeTab, (tab) => {
    if (tab === "infrastructure" && !infraQueried.value && !infraNoLayers.value) {
      queryInfrastructure();
    }
    if (tab === "dynamics" && dynamicsResult.value === null) {
      refreshDynamics();
    }
  });

  watch(radiusValues, () => {
    if (activeTab.value === "dynamics") {
      refreshDynamics();
    }
  });

  // Re-query when parcel detail data arrives or changes
  watch(
    () => props.detail,
    () => {
      if (infraRetryTimer !== null) {
        clearTimeout(infraRetryTimer);
        infraRetryTimer = null;
      }
      infraResult.value = null;
      infraNoLayers.value = false;
      infraQueried.value = false;
      infraRetryCount = 0;
      dynamicsResult.value = null;
      if (props.detail !== null) {
        queryInfrastructure();
        if (activeTab.value === "dynamics") {
          refreshDynamics();
        }
      }
    }
  );

  // --- Lifecycle ---

  onMounted(() => {
    queryInfrastructure();
  });

  onUnmounted(() => {
    if (infraRetryTimer !== null) {
      clearTimeout(infraRetryTimer);
    }
  });

  // --- Helpers ---

  function pctOfMarket(radiusVal: number, marketVal: number): string | null {
    if (marketVal <= 0) return null;
    const pct = (radiusVal / marketVal) * 100;
    return `${pct.toFixed(0)}% of Market Total`;
  }

  function formatPct(value: number | null): string {
    if (value === null) return "-";
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

  function onClose(): void {
    emit("close");
  }
</script>

<template>
  <Transition enter-active-class="transition-opacity duration-100" enter-from-class="opacity-0">
    <aside
      v-if="props.selectedParcel !== null"
      class="pointer-events-auto fixed right-[52px] top-[120px] z-30 flex max-h-[calc(100vh-140px)] flex-col rounded-lg border border-gray-200 bg-white shadow-md"
      aria-label="Parcel detail"
    >
      <!-- Loading state -->
      <div v-if="props.isLoading" class="flex min-w-[400px] items-center justify-center p-8">
        <span class="text-sm text-[#94a3b8]">Loading parcel detail...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="props.isError" class="flex min-w-[400px] flex-col items-center gap-2 p-8">
        <span class="text-sm text-red-500">Parcel detail failed to load.</span>
        <span class="text-xs text-[#94a3b8]">Try selecting the parcel again.</span>
      </div>

      <!-- Content -->
      <template v-else-if="props.detail !== null">
        <div class="flex min-w-[400px] max-w-[440px] flex-col overflow-hidden">
          <!-- Header -->
          <div class="shrink-0 flex flex-col gap-2 p-4 pb-3">
            <!-- Title row with close button -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex flex-col gap-0.5">
                <span class="text-[12px] text-[#94a3b8]">{{ titleSubtext }}</span>
                <h2 class="m-0 text-[18px] font-semibold leading-snug text-gray-900">
                  {{ titleText }}
                </h2>
              </div>
              <button
                type="button"
                class="mt-1 flex size-6 shrink-0 items-center justify-center rounded-sm opacity-50 hover:opacity-90"
                aria-label="Close"
                @click="onClose"
              >
                <X class="size-4" />
              </button>
            </div>

            <!-- Key fields -->
            <div class="flex flex-col gap-1.5 pt-1">
              <!-- APN (only when address is title) -->
              <div v-if="hasAddress && apn !== null" class="text-[13px] text-gray-700">
                Assessor Parcel Number: <span class="font-semibold">{{ apn }}</span>
              </div>

              <!-- Owner with copy button -->
              <div v-if="owner !== null" class="flex items-center gap-1.5 text-[13px] text-gray-700">
                <span>
                  Owner: <span class="font-semibold">{{ owner }}</span>
                </span>
                <button
                  type="button"
                  class="flex size-5 items-center justify-center rounded-sm text-[#94a3b8] hover:text-gray-600"
                  :title="copySuccess ? 'Copied!' : 'Copy owner name'"
                  @click="copyOwner"
                >
                  <Copy class="size-3.5" />
                </button>
                <span v-if="copySuccess" class="text-[11px] text-green-600">Copied!</span>
              </div>

              <!-- Two-column: Zone/Zone Subtype | Size/Roughness Rating -->
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
                <div v-if="zone !== null" class="text-[12px] text-gray-600">
                  Zone: <span class="font-semibold text-gray-800">{{ zone }}</span>
                </div>
                <div v-if="sizeAcres !== null" class="text-[12px] text-gray-600">
                  Size: <span class="font-semibold text-gray-800">{{ sizeAcres }} acres</span>
                </div>
                <div v-if="zoneSubtype !== null" class="text-[12px] text-gray-600">
                  Zone Subtype: <span class="font-semibold text-gray-800">{{ zoneSubtype }}</span>
                </div>
                <div v-if="roughnessRating !== null" class="relative flex items-center gap-1 text-[12px] text-gray-600">
                  <span>
                    Roughness Rating: <span class="font-semibold text-gray-800">{{ roughnessRating }}</span>
                  </span>
                  <button
                    type="button"
                    class="flex size-4 items-center justify-center text-[#94a3b8] hover:text-gray-600"
                    @mouseenter="showRoughnessTooltip = true"
                    @mouseleave="showRoughnessTooltip = false"
                    @focus="showRoughnessTooltip = true"
                    @blur="showRoughnessTooltip = false"
                  >
                    <Info class="size-3" />
                  </button>
                  <div
                    v-if="showRoughnessTooltip"
                    class="absolute bottom-full left-0 z-50 mb-1 w-56 rounded-md border border-gray-200 bg-white p-2 text-[11px] leading-relaxed text-gray-600 shadow-lg"
                  >
                    Roughness Rating measures the terrain variation of the parcel on a scale of 1-10. Lower values indicate flatter terrain more suitable for development.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div class="shrink-0 flex items-center border-b border-gray-200 px-4">
            <button
              type="button"
              class="pb-2 pr-4 text-[13px] font-normal leading-none transition-colors"
              :class="
                activeTab === 'summary'
                  ? 'border-b-2 border-[#2563eb] text-[#2563eb]'
                  : 'text-[#94a3b8] hover:text-[#64748b]'
              "
              @click="activeTab = 'summary'"
            >
              Parcel Summary
            </button>
            <button
              type="button"
              class="pb-2 pr-4 text-[13px] font-normal leading-none transition-colors"
              :class="
                activeTab === 'infrastructure'
                  ? 'border-b-2 border-[#2563eb] text-[#2563eb]'
                  : 'text-[#94a3b8] hover:text-[#64748b]'
              "
              @click="activeTab = 'infrastructure'"
            >
              Nearby Infrastructure
            </button>
            <button
              type="button"
              class="pb-2 text-[13px] font-normal leading-none transition-colors"
              :class="
                activeTab === 'dynamics'
                  ? 'border-b-2 border-[#2563eb] text-[#2563eb]'
                  : 'text-[#94a3b8] hover:text-[#64748b]'
              "
              @click="activeTab = 'dynamics'"
            >
              Market Dynamics
            </button>
          </div>

          <!-- Tab Content -->
          <div class="min-h-0 flex-1 overflow-y-auto p-4">
            <!-- ===== PARCEL SUMMARY TAB ===== -->
            <template v-if="activeTab === 'summary'">
              <div class="rounded-md bg-[#f8fafc] p-3">
                <div class="flex gap-1">
                  <!-- Label column -->
                  <div class="flex flex-col gap-4">
                    <div v-for="section in summarySections" :key="section.title" class="flex flex-col gap-1">
                      <span class="text-[11px] font-normal uppercase tracking-wide text-[#94a3b8]">
                        {{ section.title }}
                      </span>
                      <div class="flex flex-col">
                        <template v-for="field in section.fields" :key="field.label">
                          <span v-if="field.value !== null" class="text-[12px] leading-relaxed text-[#94a3b8]">
                            {{ field.label }}
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>
                  <!-- Value column -->
                  <div class="flex flex-col gap-4">
                    <div v-for="section in summarySections" :key="section.title" class="flex flex-col gap-1">
                      <!-- Spacer matching section header height -->
                      <span class="text-[11px] leading-normal">&nbsp;</span>
                      <div class="flex flex-col">
                        <template v-for="field in section.fields" :key="field.label">
                          <span v-if="field.value !== null" class="text-[12px] font-semibold leading-relaxed text-[#94a3b8]">
                            {{ field.value }}
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- ===== NEARBY INFRASTRUCTURE TAB ===== -->
            <template v-if="activeTab === 'infrastructure'">
              <!-- No layers enabled -->
              <p
                v-if="infraNoLayers"
                class="max-w-[320px] text-[12px] font-normal leading-normal text-[#94a3b8]"
              >
                No nearby infrastructure data available for this location.
              </p>

              <!-- Infrastructure Sections -->
              <div
                v-else-if="infrastructureSections.length > 0"
                class="scrollbar-hide flex max-h-[320px] flex-col gap-2 overflow-y-auto rounded bg-[#f8fafc] p-3"
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

              <!-- Nothing found within 25km -->
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
                        <div class="flex gap-[7px]">
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

                    <!-- Donut Charts -->
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
                        <div class="flex gap-[7px]">
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
                        <div
                          class="grid grid-cols-[1fr_70px_56px_56px] gap-x-1 text-[7px] font-normal uppercase text-[#94a3b8]"
                        >
                          <span>Company</span>
                          <span class="text-right">Comm./Own. (MW)</span>
                          <span class="text-right">Pipeline (MW)</span>
                          <span class="text-right">Distance (mi)</span>
                        </div>
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
          </div>
        </div>
      </template>
    </aside>
  </Transition>
</template>
