<script setup lang="ts">
  import { Download, X } from "lucide-vue-next";
  import { computed, shallowRef, watch } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import type { ScannerSummary } from "@/features/scanner/scanner.types";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import { compareSpatialAnalysisFacilities } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import { summarizeSpatialAnalysisParcels } from "@/features/spatial-analysis/spatial-analysis-overview.service";

  interface ScannerPanelProps {
    readonly emptyMessage?: string | null;
    readonly isFiltered: boolean;
    readonly isParcelsLoading: boolean;
    readonly parcelsErrorMessage: string | null;
    readonly summary: ScannerSummary;
  }

  type ScannerPanelTab = "facilities" | "overview" | "parcels";

  const props = defineProps<ScannerPanelProps>();

  const emit = defineEmits<{
    close: [];
    export: [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const activeTab = shallowRef<ScannerPanelTab>("overview");

  const hasFacilities = computed(() => props.summary.totalCount > 0);
  const hasParcels = computed(() => props.summary.parcelSelection.count > 0);
  const hasAnyResults = computed(() => hasFacilities.value || hasParcels.value);
  const hasColocation = computed(() => props.summary.colocation.count > 0);
  const hasHyperscale = computed(() => props.summary.hyperscale.count > 0);

  const orderedFacilities = computed(() => {
    const facilities = [...props.summary.facilities];
    facilities.sort(compareSpatialAnalysisFacilities);
    return facilities;
  });

  const orderedParcels = computed(() => props.summary.parcelSelection.parcels);

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
    return formatScannerPowerMw(powerMw ?? 0);
  }
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex max-h-[78vh] w-[min(74rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-border/90 bg-card/95 p-3 shadow-2xl backdrop-blur-sm"
    aria-label="Scanner summary"
  >
    <header class="mb-3 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h2 class="m-0 text-base font-semibold">Scanner</h2>
        <p class="m-0 text-[11px] text-muted-foreground">
          {{ props.summary.totalCount }}
          facilities, {{ props.summary.parcelSelection.count }} parcels in current viewport
          <span v-if="props.isFiltered"> · filtered</span>
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="!hasAnyResults"
          class="h-7 px-2"
          @click="emit('export')"
        >
          <Download class="mr-1.5 h-3.5 w-3.5" />
          Export
        </Button>
        <button
          type="button"
          aria-label="Close scanner"
          class="rounded p-1 text-muted-foreground transition hover:bg-muted/80 hover:text-foreground"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </header>

    <p
      v-if="props.parcelsErrorMessage !== null"
      class="mb-3 rounded border border-red-400/40 bg-red-500/10 px-2 py-1 text-[11px] text-red-800"
    >
      {{ props.parcelsErrorMessage }}
    </p>

    <div v-if="hasAnyResults" class="mb-3 flex items-center gap-1">
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
        Facilities ({{ props.summary.totalCount }})
      </Button>
      <Button
        size="sm"
        :variant="activeTab === 'parcels' ? 'default' : 'ghost'"
        class="h-7 px-2"
        :disabled="!hasParcels"
        @click="activeTab = 'parcels'"
      >
        Parcels ({{ props.summary.parcelSelection.count }})
      </Button>
    </div>

    <section v-if="activeTab === 'overview'" class="flex-1 overflow-auto">
      <div class="grid gap-3 lg:grid-cols-3">
        <SpatialAnalysisPerspectiveCard
          v-if="hasColocation"
          title="Colocation"
          accent="colocation"
          :summary="props.summary.colocation"
          :providers="props.summary.topColocationProviders"
          :format-power="formatScannerPowerMw"
          power-label="Power"
        />

        <SpatialAnalysisPerspectiveCard
          v-if="hasHyperscale"
          title="Hyperscale"
          accent="hyperscale"
          :summary="props.summary.hyperscale"
          :providers="props.summary.topHyperscaleProviders"
          :format-power="formatScannerPowerMw"
          power-label="Power"
        />

        <article
          v-if="hasParcels"
          class="rounded-md border border-border/60 bg-muted/20 p-2"
          aria-label="Parcel summary"
        >
          <div class="mb-1 flex items-center gap-1.5">
            <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <h3 class="m-0 text-xs font-semibold text-emerald-700">Parcels</h3>
          </div>
          <dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 text-[11px]">
            <dt class="text-muted-foreground">Records</dt>
            <dd class="m-0 font-medium">{{ props.summary.parcelSelection.count }}</dd>
            <dt class="text-muted-foreground">States</dt>
            <dd class="m-0">{{ parcelOverview.stateCount }}</dd>
            <dt class="text-muted-foreground">Counties</dt>
            <dd class="m-0">{{ parcelOverview.countyCount }}</dd>
            <dt class="text-muted-foreground">Truncated</dt>
            <dd class="m-0">{{ props.summary.parcelSelection.truncated ? "yes" : "no" }}</dd>
            <dt class="text-muted-foreground">Next Cursor</dt>
            <dd class="m-0 font-mono text-[10px]">
              {{ props.summary.parcelSelection.nextCursor ?? "-" }}
            </dd>
          </dl>
          <p v-if="props.isParcelsLoading" class="mt-2 text-[10px] text-muted-foreground">
            Refreshing parcels…
          </p>
        </article>
      </div>
    </section>

    <section
      v-if="hasFacilities && activeTab === 'facilities'"
      class="flex-1 overflow-auto rounded-md border border-border/60"
    >
      <SpatialAnalysisFacilitiesTable
        :facilities="orderedFacilities"
        :format-power="formatFacilityPowerMw"
        :lease-semantic="false"
        perspective-display="badge"
        :show-coordinates="true"
        @select-facility="emit('select-facility', $event)"
      />
    </section>

    <section
      v-if="hasParcels && activeTab === 'parcels'"
      class="flex-1 overflow-auto rounded-md border border-border/60"
    >
      <SpatialAnalysisParcelTable :parcels="orderedParcels" />
    </section>

    <p v-if="!hasAnyResults" class="mb-3 text-[11px] text-muted-foreground">
      {{ props.emptyMessage ??
        (props.isParcelsLoading
          ? "Loading parcels in current viewport…"
          : "No facilities or parcels in this viewport.") }}
    </p>
  </aside>
</template>
