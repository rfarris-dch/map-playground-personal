<script setup lang="ts">
  import { Download, X } from "lucide-vue-next";
  import { computed, shallowRef, watch } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatMeasurePowerMw } from "@/features/measure/measure-analysis.service";
  import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import { compareSpatialAnalysisFacilities } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import { summarizeSpatialAnalysisParcels } from "@/features/spatial-analysis/spatial-analysis-overview.service";

  interface MeasureAnalysisPanelProps {
    readonly errorMessage: string | null;
    readonly isLoading: boolean;
    readonly summary: MeasureSelectionSummary | null;
  }

  type MeasureAnalysisTab = "facilities" | "overview" | "parcels";

  const props = defineProps<MeasureAnalysisPanelProps>();

  const emit = defineEmits<{
    clear: [];
    export: [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const activeTab = shallowRef<MeasureAnalysisTab>("overview");

  const EMPTY_SELECTION_SUMMARY: MeasureSelectionSummary = {
    colocation: {
      commissionedPowerMw: 0,
      count: 0,
      leasedCount: 0,
      operationalCount: 0,
      plannedCount: 0,
      underConstructionCount: 0,
      unknownCount: 0,
    },
    facilities: [],
    hyperscale: {
      commissionedPowerMw: 0,
      count: 0,
      leasedCount: 0,
      operationalCount: 0,
      plannedCount: 0,
      underConstructionCount: 0,
      unknownCount: 0,
    },
    parcelSelection: {
      count: 0,
      nextCursor: null,
      parcels: [],
      truncated: false,
    },
    ring: [],
    topColocationProviders: [],
    topHyperscaleProviders: [],
    totalCount: 0,
  };

  const selectionSummary = computed(() => props.summary ?? EMPTY_SELECTION_SUMMARY);
  const isSummaryLoading = computed(() => props.isLoading);
  const hasFacilities = computed(() => selectionSummary.value.totalCount > 0);
  const hasParcels = computed(() => selectionSummary.value.parcelSelection.count > 0);
  const hasAnyResults = computed(() => hasFacilities.value || hasParcels.value);
  const hasColocation = computed(() => selectionSummary.value.colocation.count > 0);
  const hasHyperscale = computed(() => selectionSummary.value.hyperscale.count > 0);

  const orderedFacilities = computed(() => {
    const facilities = [...selectionSummary.value.facilities];
    facilities.sort(compareSpatialAnalysisFacilities);
    return facilities;
  });

  const orderedParcels = computed(() => selectionSummary.value.parcelSelection.parcels);

  const parcelOverview = computed(() => summarizeSpatialAnalysisParcels(orderedParcels.value));

  watch(hasAnyResults, (nextHasAnyResults) => {
    if (!nextHasAnyResults) {
      activeTab.value = "overview";
    }
  });

  watch(hasParcels, (nextHasParcels) => {
    if (!nextHasParcels && activeTab.value === "parcels") {
      activeTab.value = "overview";
    }
  });

  function formatFacilityPowerMw(powerMw: number | null): string {
    if (powerMw === null || !Number.isFinite(powerMw) || powerMw <= 0) {
      return "-";
    }

    if (powerMw >= 1000) {
      return (powerMw / 1000).toFixed(1);
    }

    if (powerMw >= 100) {
      return `${Math.round(powerMw)}`;
    }

    return powerMw.toFixed(1);
  }
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex max-h-[74vh] w-[min(96rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-border/90 bg-card/95 p-3 shadow-2xl backdrop-blur-sm"
    aria-label="Selection analysis"
  >
    <header class="mb-3 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="m-0 text-base font-semibold">Selection Summary</h2>
        <p class="m-0 text-[11px] text-muted-foreground">
          <template v-if="isSummaryLoading"
            >Loading selection summary for selected geometry…</template
          >
          <template v-else>
            {{ selectionSummary.totalCount }}
            facilities, {{ selectionSummary.parcelSelection.count }} parcels in selected geometry
          </template>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span v-if="isSummaryLoading" class="text-[11px] text-muted-foreground">Refreshing...</span>
        <button
          type="button"
          aria-label="Clear selection"
          class="rounded p-1 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
          @click="emit('clear')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </header>

    <p
      v-if="props.errorMessage !== null"
      class="mb-3 rounded border border-red-400/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-800"
    >
      {{ props.errorMessage }}
    </p>

    <div v-if="!isSummaryLoading && hasAnyResults" class="mb-3 flex items-center gap-1">
      <Button
        size="sm"
        :variant="activeTab === 'overview' ? 'default' : 'ghost'"
        class="h-7 px-2"
        @click="activeTab = 'overview'"
      >
        Overview
      </Button>
      <Button
        size="sm"
        :variant="activeTab === 'facilities' ? 'default' : 'ghost'"
        class="h-7 px-2"
        :disabled="!hasFacilities"
        @click="activeTab = 'facilities'"
      >
        Facilities ({{ selectionSummary.totalCount }})
      </Button>
      <Button
        size="sm"
        :variant="activeTab === 'parcels' ? 'default' : 'ghost'"
        class="h-7 px-2"
        :disabled="!hasParcels"
        @click="activeTab = 'parcels'"
      >
        Parcels ({{ selectionSummary.parcelSelection.count }})
      </Button>
    </div>

    <section
      v-if="isSummaryLoading"
      class="mb-3 flex-1 overflow-auto rounded-md border border-border/60 bg-muted/10 p-3"
      aria-label="Selection summary loading"
    >
      <div class="animate-pulse space-y-2" role="status" aria-live="polite" aria-busy="true">
        <div class="h-3 w-40 rounded bg-muted" />
        <div class="h-3 w-56 rounded bg-muted" />
        <div class="h-3 w-48 rounded bg-muted" />
      </div>
    </section>

    <section v-if="!isSummaryLoading && activeTab === 'overview'" class="mb-3 flex-1 overflow-auto">
      <div class="grid gap-3 lg:grid-cols-3">
        <SpatialAnalysisPerspectiveCard
          v-if="hasColocation"
          title="Colocation"
          accent="colocation"
          :summary="selectionSummary.colocation"
          :providers="selectionSummary.topColocationProviders"
          :format-power="formatMeasurePowerMw"
          power-label="Commissioned"
        />

        <SpatialAnalysisPerspectiveCard
          v-if="hasHyperscale"
          title="Hyperscale"
          accent="hyperscale"
          :summary="selectionSummary.hyperscale"
          :providers="selectionSummary.topHyperscaleProviders"
          :format-power="formatMeasurePowerMw"
          power-label="Commissioned"
        />

        <article
          class="rounded-md border border-border/60 bg-muted/20 p-2"
          aria-label="Parcel summary"
        >
          <div class="mb-1 flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <h3 class="m-0 text-xs font-semibold text-emerald-700">Parcels</h3>
          </div>
          <dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
            <dt class="text-muted-foreground">Selected Parcels</dt>
            <dd class="m-0 font-medium">{{ selectionSummary.parcelSelection.count }}</dd>
            <dt class="text-muted-foreground">States</dt>
            <dd class="m-0">{{ parcelOverview.stateCount }}</dd>
            <dt class="text-muted-foreground">Counties</dt>
            <dd class="m-0">{{ parcelOverview.countyCount }}</dd>
            <dt class="text-muted-foreground">Truncated</dt>
            <dd class="m-0">{{ selectionSummary.parcelSelection.truncated ? "Yes" : "No" }}</dd>
            <dt class="text-muted-foreground">Next Cursor</dt>
            <dd class="m-0 font-mono text-[10px]">
              {{ selectionSummary.parcelSelection.nextCursor === null ? "-" : selectionSummary.parcelSelection.nextCursor }}
            </dd>
          </dl>
        </article>
      </div>
    </section>

    <section
      v-if="!isSummaryLoading && hasFacilities && activeTab === 'facilities'"
      class="mb-3 flex-1 overflow-auto rounded-md border border-border/60"
    >
      <SpatialAnalysisFacilitiesTable
        :facilities="orderedFacilities"
        :format-power="formatFacilityPowerMw"
        power-heading="Comm/Own (MW)"
        perspective-display="dot"
        @select-facility="emit('select-facility', $event)"
      />
    </section>

    <section
      v-if="!isSummaryLoading && hasParcels && activeTab === 'parcels'"
      class="mb-3 flex-1 overflow-auto rounded-md border border-border/60"
    >
      <SpatialAnalysisParcelTable :parcels="orderedParcels" />
    </section>

    <p v-if="!(isSummaryLoading || hasAnyResults)" class="mb-3 text-[11px] text-muted-foreground">
      No facilities or parcels in this selection.
    </p>

    <footer class="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        :disabled="isSummaryLoading || !hasFacilities"
        @click="emit('export')"
      >
        <Download class="mr-1 h-3.5 w-3.5" />
        Export Facilities
      </Button>
      <Button size="sm" variant="ghost" class="ml-auto" @click="emit('clear')">Clear</Button>
    </footer>
  </aside>
</template>
