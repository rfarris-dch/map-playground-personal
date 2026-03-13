<script setup lang="ts">
  import { ArrowRight, Download, Minus, X } from "lucide-vue-next";
  import { computed, shallowRef } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
  import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

  interface ScannerPanelProps {
    readonly countyIds: readonly string[];
    readonly emptyMessage?: string | null;
    readonly isFiltered: boolean;
    readonly isParcelsLoading: boolean;
    readonly parcelsErrorMessage: string | null;
    readonly summary: SpatialAnalysisSummaryModel;
  }

  type ScannerTab = "colocation" | "facilities" | "hyperscale" | "overview";

  interface ScannerMetricCard {
    readonly accentClass: string;
    readonly count: number;
    readonly label: string;
    readonly powerText: string;
  }

  interface ScannerSummaryRow {
    readonly detail: string;
    readonly label: string;
  }

  const props = defineProps<ScannerPanelProps>();
  const emit = defineEmits<{
    close: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const activeTab = shallowRef<ScannerTab>("overview");
  const analysisSummary = computed(() => props.summary.summary);

  const title = computed(() => {
    if (analysisSummary.value.totalCount > 0) {
      return `Scanner ${analysisSummary.value.totalCount}`;
    }

    return "Scanner";
  });

  const subtitle = computed(() => {
    const filteredText = props.isFiltered ? "Filtered" : "Viewport";
    return `${filteredText} · ${analysisSummary.value.parcelSelection.count} parcels`;
  });

  const countyCount = computed(() => {
    const ids = props.summary.area.countyIds;
    if (ids.length > 0) {
      return ids.length;
    }

    return props.countyIds.length;
  });

  const overviewCards = computed<readonly ScannerMetricCard[]>(() => [
    {
      accentClass: "bg-[#3B82F6]",
      count: analysisSummary.value.colocation.count,
      label: "Colocation",
      powerText: formatScannerPowerMw(analysisSummary.value.colocation.commissionedPowerMw),
    },
    {
      accentClass: "bg-[#10B981]",
      count: analysisSummary.value.hyperscale.count,
      label: "Hyperscale",
      powerText: formatScannerPowerMw(analysisSummary.value.hyperscale.commissionedPowerMw),
    },
  ]);

  const overviewRows = computed<readonly ScannerSummaryRow[]>(() => [
    {
      detail: `${analysisSummary.value.marketSelection?.matchCount ?? 0} matches`,
      label: "Markets",
    },
    {
      detail: `${analysisSummary.value.parcelSelection.count} records`,
      label: "Parcels",
    },
    {
      detail: `${countyCount.value} selected`,
      label: "Counties",
    },
    {
      detail: `${analysisSummary.value.topColocationProviders.length + analysisSummary.value.topHyperscaleProviders.length} tracked`,
      label: "Providers",
    },
  ]);

  const colocationRows = computed<readonly ScannerSummaryRow[]>(() => [
    {
      detail: formatScannerPowerMw(analysisSummary.value.colocation.commissionedPowerMw),
      label: "Commissioned",
    },
    {
      detail: formatScannerPowerMw(analysisSummary.value.colocation.pipelinePowerMw),
      label: "Pipeline",
    },
    {
      detail: `${analysisSummary.value.colocation.operationalCount}`,
      label: "Operational",
    },
    {
      detail: `${analysisSummary.value.colocation.leasedCount}`,
      label: "Leased",
    },
    {
      detail: `${analysisSummary.value.colocation.underConstructionCount}`,
      label: "Under Const.",
    },
    {
      detail: `${analysisSummary.value.colocation.plannedCount}`,
      label: "Planned",
    },
  ]);

  const hyperscaleRows = computed<readonly ScannerSummaryRow[]>(() => [
    {
      detail: formatScannerPowerMw(analysisSummary.value.hyperscale.commissionedPowerMw),
      label: "Commissioned",
    },
    {
      detail: formatScannerPowerMw(analysisSummary.value.hyperscale.pipelinePowerMw),
      label: "Pipeline",
    },
    {
      detail: `${analysisSummary.value.hyperscale.operationalCount}`,
      label: "Operational",
    },
    {
      detail: `${analysisSummary.value.hyperscale.leasedCount}`,
      label: "Leased",
    },
    {
      detail: `${analysisSummary.value.hyperscale.underConstructionCount}`,
      label: "Under Const.",
    },
    {
      detail: `${analysisSummary.value.hyperscale.plannedCount}`,
      label: "Planned",
    },
  ]);

  const topFacilities = computed(() => analysisSummary.value.facilities.slice(0, 10));
  const hasResults = computed(
    () =>
      analysisSummary.value.totalCount > 0 ||
      analysisSummary.value.parcelSelection.count > 0 ||
      countyCount.value > 0
  );

  const facilitiesTabDisabled = computed(() => topFacilities.value.length === 0);
  const dashboardDisabled = computed(
    () =>
      analysisSummary.value.totalCount === 0 && analysisSummary.value.parcelSelection.count === 0
  );
  const exportDisabled = computed(() => analysisSummary.value.totalCount === 0);

  function facilityLocationText(facility: SpatialAnalysisFacilityRecord): string {
    const parts = [facility.city, facility.stateAbbrev ?? facility.state].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );

    if (parts.length > 0) {
      return parts.join(", ");
    }

    return "Location unavailable";
  }

  function selectFacility(facility: SpatialAnalysisFacilityRecord): void {
    emit("select-facility", {
      facilityId: facility.facilityId,
      perspective: facility.perspective,
    });
  }

  function tabClass(tab: ScannerTab): string {
    const isActive = activeTab.value === tab;

    if (isActive) {
      return "border-b-[#64748B] text-[#64748B]";
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
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex w-[197px] max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-[4px] border border-[#E2E8F0] bg-white p-2 [font-family:Inter,var(--font-sans)] text-[#94A3B8] shadow-[0_4px_8px_rgba(0,0,0,0.06)]"
    aria-label="Scanner"
  >
    <header class="mb-2">
      <div class="mb-1 flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="m-0 text-[10px] font-semibold leading-none text-[#64748B]">{{ title }}</h2>
          <p class="mt-1 mb-0 text-[7px] leading-[1.1] text-[#94A3B8]">{{ subtitle }}</p>
        </div>

        <div class="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Minimize scanner"
            class="inline-flex h-3 w-3 items-center justify-center text-[#94A3B8] transition-colors hover:text-[#64748B]"
            @click="emit('close')"
          >
            <Minus class="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Close scanner"
            class="inline-flex h-3 w-3 items-center justify-center text-[#94A3B8] transition-colors hover:text-[#64748B]"
            @click="emit('close')"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </div>

      <nav class="flex items-end gap-1 border-b border-[#E2E8F0] pb-0.5" aria-label="Scanner tabs">
        <button
          type="button"
          class="border-b px-1 py-0 text-[7px] font-medium leading-none transition-colors"
          :class="tabClass('overview')"
          @click="setActiveTab('overview')"
        >
          Overview
        </button>
        <button
          type="button"
          class="border-b px-1 py-0 text-[7px] font-medium leading-none transition-colors"
          :class="tabClass('colocation')"
          @click="setActiveTab('colocation')"
        >
          Colocation
        </button>
        <button
          type="button"
          class="border-b px-1 py-0 text-[7px] font-medium leading-none transition-colors"
          :class="tabClass('hyperscale')"
          @click="setActiveTab('hyperscale')"
        >
          Hyperscale
        </button>
        <button
          type="button"
          class="border-b px-1 py-0 text-[7px] font-medium leading-none transition-colors"
          :class="tabClass('facilities')"
          @click="setActiveTab('facilities')"
        >
          Facilities
        </button>
      </nav>
    </header>

    <p
      v-if="props.parcelsErrorMessage"
      class="mb-2 rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-2 py-1 text-[7px] text-[#B91C1C]"
    >
      {{ props.parcelsErrorMessage }}
    </p>

    <section
      v-if="!hasResults"
      class="flex-1 rounded-[4px] border border-dashed border-[#E2E8F0] px-2 py-3 text-center text-[7px] text-[#94A3B8]"
    >
      {{ props.emptyMessage ?? "No facilities or parcels in this viewport." }}
    </section>

    <section v-else-if="activeTab === 'overview'" class="flex-1 overflow-auto">
      <div class="grid grid-cols-2 gap-2">
        <article
          v-for="card in overviewCards"
          :key="card.label"
          class="rounded-[4px] border border-[#E2E8F0] bg-white p-1.5"
        >
          <div class="mb-1 flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full" :class="card.accentClass" />
            <span class="text-[7px] font-medium leading-none text-[#64748B]">{{ card.label }}</span>
          </div>
          <div class="text-[10px] font-semibold leading-none text-[#64748B]">{{ card.count }}</div>
          <div class="mt-1 text-[7px] leading-none text-[#94A3B8]">{{ card.powerText }}</div>
        </article>
      </div>

      <div class="mt-2 space-y-1">
        <div
          v-for="row in overviewRows"
          :key="row.label"
          class="flex items-center justify-between gap-2 text-[7px] leading-none text-[#64748B]"
        >
          <span>{{ row.label }}</span>
          <span class="text-[#94A3B8]">{{ row.detail }}</span>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'colocation'" class="flex-1 overflow-auto">
      <div class="mb-2">
        <div class="text-[10px] font-semibold leading-none text-[#64748B]">
          {{ analysisSummary.colocation.count }}
        </div>
        <div class="mt-1 text-[7px] leading-none text-[#94A3B8]">Colocation facilities</div>
      </div>

      <div class="space-y-1">
        <div
          v-for="row in colocationRows"
          :key="row.label"
          class="flex items-center justify-between gap-2 text-[7px] leading-none text-[#64748B]"
        >
          <span>{{ row.label }}</span>
          <span class="text-[#94A3B8]">{{ row.detail }}</span>
        </div>
      </div>
    </section>

    <section v-else-if="activeTab === 'hyperscale'" class="flex-1 overflow-auto">
      <div class="mb-2">
        <div class="text-[10px] font-semibold leading-none text-[#64748B]">
          {{ analysisSummary.hyperscale.count }}
        </div>
        <div class="mt-1 text-[7px] leading-none text-[#94A3B8]">Hyperscale facilities</div>
      </div>

      <div class="space-y-1">
        <div
          v-for="row in hyperscaleRows"
          :key="row.label"
          class="flex items-center justify-between gap-2 text-[7px] leading-none text-[#64748B]"
        >
          <span>{{ row.label }}</span>
          <span class="text-[#94A3B8]">{{ row.detail }}</span>
        </div>
      </div>
    </section>

    <section v-else class="flex-1 overflow-auto">
      <div
        class="mb-1 grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[6px] uppercase leading-none text-[#94A3B8]"
      >
        <span>Name</span>
        <span class="text-right">MW</span>
        <span class="text-right">SF</span>
        <span class="text-right">Type</span>
      </div>

      <button
        v-for="facility in topFacilities"
        :key="facility.facilityId"
        type="button"
        class="grid w-full grid-cols-[1fr_auto_auto_auto] gap-x-2 border-t border-[#E2E8F0] py-1 text-left text-[7px] leading-none transition-colors hover:bg-[#F8FAFC]"
        @click="selectFacility(facility)"
      >
        <span class="min-w-0">
          <span class="block truncate font-medium text-[#64748B]">{{ facility.facilityName }}</span>
          <span class="mt-0.5 block truncate text-[#94A3B8]"
            >{{ facilityLocationText(facility) }}</span
          >
        </span>
        <span class="text-right text-[#64748B]">
          {{ formatScannerPowerMw(facility.commissionedPowerMw ?? 0) }}
        </span>
        <span class="text-right text-[#64748B]">
          {{ facility.squareFootage === null ? "-" : Math.round(facility.squareFootage).toLocaleString() }}
        </span>
        <span class="text-right text-[#94A3B8]">
          {{ facility.perspective === "colocation" ? "Colo" : "Hyper" }}
        </span>
      </button>
    </section>

    <footer class="mt-2 flex items-center gap-2">
      <button
        type="button"
        class="inline-flex h-5 flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-[7px] font-medium text-[#64748B] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="dashboardDisabled"
        @click="emit('open-dashboard')"
      >
        <ArrowRight class="h-3 w-3" />
        Open
      </button>
      <button
        type="button"
        class="inline-flex h-5 flex-1 items-center justify-center gap-1 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-[7px] font-medium text-[#64748B] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="exportDisabled"
        @click="emit('export')"
      >
        <Download class="h-3 w-3" />
        Export
      </button>
    </footer>
  </aside>
</template>
