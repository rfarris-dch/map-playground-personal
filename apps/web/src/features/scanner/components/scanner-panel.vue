<script setup lang="ts">
  import { ArrowRight, ChevronDown, Download, Minus, X } from "lucide-vue-next";
  import { computed, shallowRef } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
  import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";
  import { buildDonutChartArcSegments } from "@/lib/donut-chart.service";

  interface ScannerPanelProps {
    readonly countyIds: readonly string[];
    readonly emptyMessage?: string | null;
    readonly isFiltered: boolean;
    readonly isParcelsLoading: boolean;
    readonly parcelsErrorMessage: string | null;
    readonly summary: SpatialAnalysisSummaryModel;
  }

  type ScannerTab = "colocation" | "facilities" | "hyperscale" | "overview";

  const props = defineProps<ScannerPanelProps>();
  const emit = defineEmits<{
    close: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const activeTab = shallowRef<ScannerTab>("overview");
  const topCompaniesExpanded = shallowRef(false);
  const analysisSummary = computed(() => props.summary.summary);

  const totalCount = computed(() => analysisSummary.value.totalCount);
  const marketCount = computed(() => analysisSummary.value.marketSelection?.matchCount ?? 0);

  const headerSubtitle = computed(() => {
    const f = totalCount.value;
    const m = marketCount.value;
    return `${f} ${f === 1 ? "Facility" : "Facilities"} \u2022 ${m} ${m === 1 ? "Market" : "Markets"}`;
  });

  const countyCount = computed(() => {
    const ids = props.summary.area.countyIds;
    return ids.length > 0 ? ids.length : props.countyIds.length;
  });

  const hasResults = computed(
    () =>
      analysisSummary.value.totalCount > 0 ||
      analysisSummary.value.parcelSelection.count > 0 ||
      countyCount.value > 0
  );

  const topFacilities = computed(() => analysisSummary.value.facilities.slice(0, 15));
  const facilitiesTabDisabled = computed(() => topFacilities.value.length === 0);
  const dashboardDisabled = computed(
    () =>
      analysisSummary.value.totalCount === 0 && analysisSummary.value.parcelSelection.count === 0
  );
  const exportDisabled = computed(() => analysisSummary.value.totalCount === 0);

  // Donut chart helpers
  function donutSegments(commissioned: number, uc: number, planned: number, isColo: boolean) {
    return buildDonutChartArcSegments({
      centerX: 50,
      centerY: 50,
      radius: 36,
      segments: [
        { color: isColo ? "#3b82f6" : "#10b981", value: commissioned },
        { color: isColo ? "#93c5fd" : "#6ee7b7", value: uc },
        { color: isColo ? "#dbeafe" : "#d1fae5", value: planned },
      ],
    });
  }

  const coloDonut = computed(() =>
    donutSegments(
      analysisSummary.value.colocation.commissionedPowerMw,
      analysisSummary.value.colocation.pipelinePowerMw,
      0,
      true
    )
  );

  const hyperDonut = computed(() =>
    donutSegments(
      analysisSummary.value.hyperscale.commissionedPowerMw,
      analysisSummary.value.hyperscale.pipelinePowerMw,
      0,
      false
    )
  );

  const coloTotalMw = computed(
    () =>
      analysisSummary.value.colocation.commissionedPowerMw +
      analysisSummary.value.colocation.pipelinePowerMw
  );

  const hyperTotalMw = computed(
    () =>
      analysisSummary.value.hyperscale.commissionedPowerMw +
      analysisSummary.value.hyperscale.pipelinePowerMw
  );

  // Colocation/Hyperscale metric rows
  interface MetricRow {
    readonly label: string;
    readonly value: string;
  }

  const colocationMetrics = computed<readonly MetricRow[]>(() => [
    { label: "Colocation Capacity Snapshot (MW)", value: "" },
    {
      label: "Provider Total Capacity (MW)",
      value: formatScannerPowerMw(
        analysisSummary.value.colocation.commissionedPowerMw +
          analysisSummary.value.colocation.pipelinePowerMw
      ),
    },
    {
      label: "Commissioned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.commissionedPowerMw),
    },
    {
      label: "Planned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.colocation.pipelinePowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: `${analysisSummary.value.colocation.underConstructionCount}`,
    },
    {
      label: "Available Power (MW)",
      value: "—",
    },
    {
      label: "Facility Count",
      value: `${analysisSummary.value.colocation.count}`,
    },
  ]);

  const hyperscaleMetrics = computed<readonly MetricRow[]>(() => [
    { label: "Hyperscale Capacity Snapshot (MW)", value: "" },
    {
      label: "User Total Capacity (MW)",
      value: formatScannerPowerMw(
        analysisSummary.value.hyperscale.commissionedPowerMw +
          analysisSummary.value.hyperscale.pipelinePowerMw
      ),
    },
    {
      label: "Commissioned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.commissionedPowerMw),
    },
    {
      label: "Planned Power (MW)",
      value: formatScannerPowerMw(analysisSummary.value.hyperscale.pipelinePowerMw),
    },
    {
      label: "Under Construction Power (MW)",
      value: `${analysisSummary.value.hyperscale.underConstructionCount}`,
    },
    {
      label: "Available Power (MW)",
      value: "—",
    },
    {
      label: "Facility Count",
      value: `${analysisSummary.value.hyperscale.count}`,
    },
  ]);

  function selectFacility(facility: SpatialAnalysisFacilityRecord): void {
    emit("select-facility", {
      facilityId: facility.facilityId,
      perspective: facility.perspective,
    });
  }

  function tabClass(tab: ScannerTab): string {
    if (activeTab.value === tab) {
      return "border-b-[#2563eb] text-[#2563eb]";
    }
    if (tab === "facilities" && facilitiesTabDisabled.value) {
      return "border-b-transparent text-[#CBD5E1]";
    }
    return "border-b-transparent text-[#94A3B8] hover:text-[#64748B]";
  }

  function setActiveTab(tab: ScannerTab): void {
    if (tab === "facilities" && facilitiesTabDisabled.value) {
      return;
    }
    activeTab.value = tab;
  }
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex w-[380px] max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-[#cbd5e1] bg-white [font-family:Inter,var(--font-sans)] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
    aria-label="Scanner"
  >
    <div class="flex flex-col gap-4 p-4">
      <!-- Header -->
      <header>
        <div class="mb-2 flex items-start justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-[#334155]">Spotlight</span>
            <span class="text-xs text-[#94a3b8]">{{ headerSubtitle }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="Minimize"
              class="inline-flex size-5 items-center justify-center rounded text-[#cbd5e1] hover:bg-[#f1f5f9] hover:text-[#64748b]"
              @click="emit('close')"
            >
              <Minus class="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Close"
              class="inline-flex size-5 items-center justify-center rounded text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#64748b]"
              @click="emit('close')"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <nav class="flex items-end gap-1 border-b border-[#e2e8f0]" aria-label="Scanner tabs">
          <button
            v-for="tab in (['overview', 'colocation', 'hyperscale', 'facilities'] as const)"
            :key="tab"
            type="button"
            class="border-b-2 px-3 pb-2 pt-1 text-xs leading-none transition-colors capitalize"
            :class="tabClass(tab)"
            @click="setActiveTab(tab)"
          >
            {{ tab }}
          </button>
        </nav>
      </header>

      <!-- Error -->
      <p
        v-if="props.parcelsErrorMessage"
        class="rounded bg-[#FEF2F2] border border-[#FECACA] px-3 py-2 text-xs text-[#B91C1C]"
      >
        {{ props.parcelsErrorMessage }}
      </p>

      <!-- Empty state -->
      <section
        v-if="!hasResults"
        class="flex-1 rounded border border-dashed border-[#E2E8F0] px-4 py-6 text-center text-xs text-[#94A3B8]"
      >
        {{ props.emptyMessage ?? "No facilities or parcels in this viewport." }}
      </section>

      <!-- ═══ OVERVIEW TAB ═══ -->
      <section v-else-if="activeTab === 'overview'" class="flex flex-col gap-4 overflow-auto">
        <!-- Colocation + Hyperscale side by side -->
        <div class="flex gap-6">
          <!-- Colocation -->
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-semibold text-[#3b82f6]">Colocation</div>
              <div class="text-xs text-[#94a3b8]">
                {{ analysisSummary.colocation.count }}
                Facilities &bull;
                {{ analysisSummary.topColocationProviders.length }}
                Providers
              </div>
            </div>
            <div class="relative size-[100px]">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="36" fill="none" stroke="#f1f5f9" stroke-width="12" />
                <template v-for="(seg, i) in coloDonut" :key="`colo-${String(i)}`">
                  <circle
                    v-if="seg.path === null"
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                  <path
                    v-else
                    :d="seg.path"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                </template>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[11px] text-[#94a3b8]">
                  {{ formatScannerPowerMw(coloTotalMw) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Hyperscale -->
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-semibold text-[#10b981]">Hyperscale</div>
              <div class="text-xs text-[#94a3b8]">
                {{ analysisSummary.hyperscale.count }}
                Facilities &bull;
                {{ analysisSummary.topHyperscaleProviders.length }}
                Users
              </div>
            </div>
            <div class="relative size-[100px]">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="36" fill="none" stroke="#f1f5f9" stroke-width="12" />
                <template v-for="(seg, i) in hyperDonut" :key="`hyper-${String(i)}`">
                  <circle
                    v-if="seg.path === null"
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                  <path
                    v-else
                    :d="seg.path"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                </template>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-[11px] text-[#94a3b8]">
                  {{ formatScannerPowerMw(hyperTotalMw) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Top Companies -->
        <div>
          <button
            type="button"
            class="flex items-center gap-2 text-left"
            @click="topCompaniesExpanded = !topCompaniesExpanded"
          >
            <span class="text-xs font-semibold text-[#334155]">Top Companies</span>
            <span class="text-xs text-[#94a3b8]">(Providers &amp; Users)</span>
            <ChevronDown
              class="size-3.5 text-[#94a3b8] transition-transform"
              :class="{ 'rotate-180': topCompaniesExpanded }"
            />
          </button>

          <div v-if="topCompaniesExpanded" class="mt-3 flex gap-6">
            <!-- Top Providers -->
            <div class="flex-1">
              <div class="mb-2 text-xs font-semibold text-[#94a3b8]">Top Providers</div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="p in analysisSummary.topColocationProviders.slice(0, 5)"
                  :key="p.providerId"
                  class="text-xs leading-[1.4]"
                >
                  <div class="font-medium text-[#334155]">{{ p.providerName }}</div>
                  <div class="flex gap-3 text-[11px] text-[#94a3b8]">
                    <span>Comm. {{ formatScannerPowerMw(p.commissionedPowerMw) }}</span>
                    <span>Facilities: {{ p.facilityCount }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Top Users -->
            <div class="flex-1">
              <div class="mb-2 text-xs font-semibold text-[#94a3b8]">Top Users</div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="p in analysisSummary.topHyperscaleProviders.slice(0, 5)"
                  :key="p.providerId"
                  class="text-xs leading-[1.4]"
                >
                  <div class="font-medium text-[#334155]">{{ p.providerName }}</div>
                  <div class="flex gap-3 text-[11px] text-[#94a3b8]">
                    <span>Comm. {{ formatScannerPowerMw(p.commissionedPowerMw) }}</span>
                    <span>Facilities: {{ p.facilityCount }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══ COLOCATION TAB ═══ -->
      <section v-else-if="activeTab === 'colocation'" class="flex flex-col gap-2 overflow-auto">
        <div class="mb-1">
          <div class="text-sm font-semibold text-[#3b82f6]">Colocation</div>
          <div class="text-xs text-[#94a3b8]">
            {{ analysisSummary.colocation.count }}
            Facilities &bull;
            {{ analysisSummary.topColocationProviders.length }}
            Providers
          </div>
        </div>
        <div
          v-for="row in colocationMetrics"
          :key="row.label"
          class="flex items-center justify-between gap-2 py-1 text-xs text-[#94a3b8]"
        >
          <span>{{ row.label }}</span>
          <ChevronDown v-if="row.value === ''" class="size-3.5" />
          <span v-else>{{ row.value }}</span>
        </div>
      </section>

      <!-- ═══ HYPERSCALE TAB ═══ -->
      <section v-else-if="activeTab === 'hyperscale'" class="flex flex-col gap-2 overflow-auto">
        <div class="mb-1">
          <div class="text-sm font-semibold text-[#10b981]">Hyperscale</div>
          <div class="text-xs text-[#94a3b8]">
            {{ analysisSummary.hyperscale.count }}
            Facilities &bull;
            {{ analysisSummary.topHyperscaleProviders.length }}
            Users
          </div>
        </div>
        <div
          v-for="row in hyperscaleMetrics"
          :key="row.label"
          class="flex items-center justify-between gap-2 py-1 text-xs text-[#94a3b8]"
        >
          <span>{{ row.label }}</span>
          <ChevronDown v-if="row.value === ''" class="size-3.5" />
          <span v-else>{{ row.value }}</span>
        </div>
      </section>

      <!-- ═══ FACILITIES TAB ═══ -->
      <section v-else class="flex-1 overflow-auto">
        <!-- Table header -->
        <div
          class="grid grid-cols-[1fr_70px_52px_40px_40px] gap-x-2 border-b border-[#e2e8f0] pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8] whitespace-nowrap"
        >
          <span>Name</span>
          <span class="text-right">Company</span>
          <span class="text-right">Comm</span>
          <span class="text-right">UC</span>
          <span class="text-right">Plan</span>
        </div>

        <button
          v-for="facility in topFacilities"
          :key="facility.facilityId"
          type="button"
          class="grid w-full grid-cols-[1fr_70px_52px_40px_40px] gap-x-2 border-b border-[#f1f5f9] py-1.5 text-left text-xs leading-snug transition-colors hover:bg-[#f8fafc] whitespace-nowrap"
          @click="selectFacility(facility)"
        >
          <span class="min-w-0 flex items-center gap-1.5">
            <span
              class="inline-block size-[6px] flex-shrink-0 rounded-full"
              :class="{
                'bg-[#3b82f6]': facility.perspective === 'colocation',
                'bg-[#10b981]': facility.perspective === 'hyperscale',
              }"
            />
            <span class="truncate text-[#334155]">{{ facility.facilityName }}</span>
          </span>
          <span class="truncate text-right text-[#94a3b8]">
            {{ facility.providerName?.split(" ")[0] ?? "—" }}
          </span>
          <span class="text-right text-[#94a3b8]">
            {{ facility.commissionedPowerMw !== null ? facility.commissionedPowerMw.toFixed(1) : "—" }}
          </span>
          <span class="text-right text-[#94a3b8]">
            {{ facility.underConstructionPowerMw !== null ? facility.underConstructionPowerMw.toFixed(1) : "—" }}
          </span>
          <span class="text-right text-[#94a3b8]">
            {{ facility.plannedPowerMw !== null ? facility.plannedPowerMw.toFixed(1) : "—" }}
          </span>
        </button>
      </section>

      <!-- Footer buttons -->
      <footer class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#94a3b8] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="dashboardDisabled"
          @click="emit('open-dashboard')"
        >
          Open Dashboard
          <ArrowRight class="size-3.5" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-[#94a3b8] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="exportDisabled"
          @click="emit('export')"
        >
          <Download class="size-3.5" />
          Export Facilities
        </button>
      </footer>
    </div>
  </aside>
</template>
