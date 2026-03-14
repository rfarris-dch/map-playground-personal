<script setup lang="ts">
  import { Download, LayoutDashboard, X } from "lucide-vue-next";
  import Button from "@/components/ui/button/button.vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import SpatialAnalysisCountyScoresSection from "@/features/spatial-analysis/components/spatial-analysis-county-scores-section.vue";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import type { SpatialAnalysisPanelProps } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import SpatialAnalysisSummaryOverview from "@/features/spatial-analysis/components/spatial-analysis-summary-overview.vue";
  import { useSpatialAnalysisPanelState } from "@/features/spatial-analysis/components/use-spatial-analysis-panel-state";

  const props = defineProps<SpatialAnalysisPanelProps>();

  const emit = defineEmits<{
    "open-dashboard": [];
    dismiss: [];
    export: [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const {
    activeTab,
    countyScores,
    countyScoresError,
    countyScoresStatus,
    countyScoresStatusError,
    formatOverlapPercent,
    hasAnyResults,
    hasColocation,
    hasCountyScores,
    hasFacilities,
    hasHyperscale,
    hasMarkets,
    hasParcels,
    marketSelectionUnavailableReason,
    matchedMarkets,
    orderedFacilities,
    orderedParcels,
    panelSummary,
    panelWidthClass,
    parcelOverview,
    progressPercentText,
    progressStageDotClass,
    progressStageStatusLabel,
    progressStatusText,
    summaryChips,
    tabClass,
    tabItems,
    visibleProgressStages,
  } = useSpatialAnalysisPanelState(props as SpatialAnalysisPanelProps);
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex max-h-[78vh] flex-col overflow-hidden rounded-sm border border-border bg-card p-2 text-muted-foreground shadow-sm transition-[width] duration-200 font-sans"
    :class="panelWidthClass"
    :aria-label="props.title"
  >
    <header class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <h2 class="m-0 text-sm font-semibold text-foreground/70">{{ props.title }}</h2>
          <span
            v-if="props.isLoading || props.isParcelsLoading"
            class="inline-flex items-center rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-xs"
          >
            {{ props.progress === null ? "Refreshing" : `Refreshing · ${progressPercentText}` }}
          </span>
        </div>
        <p class="m-0 text-xs text-muted-foreground">{{ props.subtitle }}</p>
      </div>

      <button
        type="button"
        :aria-label="props.dismissLabel"
        class="inline-flex h-6 w-6 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-xs transition-colors hover:border-border hover:bg-background hover:text-foreground/70"
        @click="emit('dismiss')"
      >
        <X class="h-4 w-4" />
      </button>
    </header>

    <p
      v-if="props.errorMessage !== null"
      class="mb-3 rounded-sm border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2 text-xs text-[var(--error)]"
    >
      {{ props.errorMessage }}
    </p>

    <div v-if="hasAnyResults" class="mb-3 flex flex-wrap items-center gap-1.5">
      <span
        v-for="chip in summaryChips"
        :key="chip.label"
        class="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground shadow-xs"
      >
        <span class="h-2 w-2 rounded-full" :class="chip.dotClass" />
        <span>{{ chip.label }}</span>
        <span class="text-foreground/70">{{ chip.value }}</span>
      </span>
    </div>

    <div
      v-if="hasAnyResults"
      class="mb-3 inline-flex rounded-sm border border-border bg-card p-1 shadow-xs"
    >
      <button
        v-for="tab in tabItems"
        :key="tab.id"
        type="button"
        class="rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="tabClass(tab)"
        :disabled="tab.disabled"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.count !== null">({{ tab.count }})</span>
      </button>
    </div>

    <section
      v-if="props.isLoading"
      class="flex-1 overflow-auto rounded-sm border border-border bg-card p-3 shadow-xs"
      :aria-label="`${props.title} loading`"
    >
      <div
        v-if="props.progress !== null"
        class="space-y-3"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="space-y-1.5">
          <div
            class="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground"
          >
            <span>Selection analysis</span>
            <span>{{ progressPercentText }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full border border-border bg-background">
            <div class="h-full w-full animate-pulse rounded-full bg-border" />
          </div>
          <p class="m-0 text-xs text-muted-foreground">{{ progressStatusText }}</p>
        </div>

        <div class="space-y-2">
          <div
            v-for="stage in visibleProgressStages"
            :key="stage.key"
            class="border-t border-border/60 px-1 pt-2 transition-all duration-300"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-2 w-2 rounded-full"
                  :class="progressStageDotClass(stage.status)"
                />
                <span class="text-xs font-medium text-foreground/70">{{ stage.label }}</span>
              </div>
              <span class="text-xs uppercase tracking-wide text-muted-foreground">
                {{ progressStageStatusLabel(stage.status) }}
              </span>
            </div>
            <p class="mt-1 mb-0 text-xs text-muted-foreground">
              {{ stage.detail ?? "Waiting to start…" }}
            </p>
          </div>
        </div>
      </div>

      <div v-else class="animate-pulse space-y-2" role="status" aria-live="polite" aria-busy="true">
        <div class="h-3 w-40 rounded bg-muted" />
        <div class="h-3 w-56 rounded bg-muted" />
        <div class="h-3 w-48 rounded bg-muted" />
      </div>
    </section>

    <section v-else-if="hasAnyResults && activeTab === 'overview'" class="flex-1 overflow-auto">
      <div class="space-y-3">
        <SpatialAnalysisSummaryOverview
          :facilities="orderedFacilities"
          :parcels="orderedParcels"
          :summary="panelSummary"
          :format-power="props.formatPower"
          @select-facility="emit('select-facility', $event)"
        />

        <div class="grid gap-3 lg:grid-cols-2">
          <SpatialAnalysisPerspectiveCard
            v-if="hasColocation"
            title="Colocation"
            accent="colocation"
            :summary="panelSummary.colocation"
            :providers="panelSummary.topColocationProviders"
            :format-power="props.formatPower"
            :power-label="props.perspectivePowerLabel ?? 'Commissioned'"
          />

          <SpatialAnalysisPerspectiveCard
            v-if="hasHyperscale"
            title="Hyperscale"
            accent="hyperscale"
            :summary="panelSummary.hyperscale"
            :providers="panelSummary.topHyperscaleProviders"
            :format-power="props.formatPower"
            :power-label="props.perspectivePowerLabel ?? 'Commissioned'"
          />

          <section
            v-if="hasMarkets || marketSelectionUnavailableReason !== null"
            class="lg:col-span-2"
            aria-label="Market summary"
          >
            <div class="mb-2 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
              <h3 class="m-0 text-xs font-semibold text-muted-foreground">Market Coverage</h3>
            </div>

            <p
              v-if="marketSelectionUnavailableReason !== null"
              class="mb-2 rounded-sm bg-background px-2 py-1.5 text-xs text-muted-foreground"
            >
              {{ marketSelectionUnavailableReason }}
            </p>

            <dl
              v-if="hasMarkets"
              class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Matches</dt>
                <dd class="m-0 font-medium text-foreground/70">
                  {{ panelSummary.marketSelection?.matchCount ?? 0 }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Primary</dt>
                <dd class="m-0 font-medium text-foreground/70">
                  {{ panelSummary.marketSelection?.primaryMarket?.name ?? "-" }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Selection Area</dt>
                <dd class="m-0 font-medium text-foreground/70">
                  {{ panelSummary.marketSelection?.selectionAreaSqKm.toFixed(1) ?? "0.0" }}
                  sq km
                </dd>
              </div>
            </dl>

            <div v-if="hasMarkets" class="mt-2 space-y-1">
              <div
                v-for="market in matchedMarkets"
                :key="market.marketId"
                class="border-t border-border/60 pt-1.5 text-xs"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium text-foreground/70">{{ market.name }}</span>
                  <span class="text-muted-foreground">
                    {{ formatOverlapPercent(market.marketOverlapPercent) }}
                  </span>
                </div>
                <div class="truncate text-xs text-muted-foreground">
                  {{ [market.region, market.state, market.country].filter(Boolean).join(" · ") || "No market metadata" }}
                </div>
                <div
                  class="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span>Market covered</span>
                  <span>{{ formatOverlapPercent(market.marketOverlapPercent) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Selection share</span>
                  <span>{{ formatOverlapPercent(market.selectionOverlapPercent) }}</span>
                </div>
              </div>
            </div>
          </section>

          <section
            v-if="hasParcels || props.isParcelsLoading"
            class="lg:col-span-2"
            aria-label="Parcel summary"
          >
            <div class="mb-2 flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-full bg-hyperscale" />
              <h3 class="m-0 text-xs font-semibold text-muted-foreground">Parcel Coverage</h3>
            </div>

            <dl
              class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs sm:grid-cols-[repeat(3,minmax(0,1fr))]"
            >
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Records</dt>
                <dd class="m-0 font-medium text-foreground/70">
                  {{ panelSummary.parcelSelection.count }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">States</dt>
                <dd class="m-0 font-medium text-foreground/70">{{ parcelOverview.stateCount }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Counties</dt>
                <dd class="m-0 font-medium text-foreground/70">{{ parcelOverview.countyCount }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-muted-foreground">Truncated</dt>
                <dd class="m-0 font-medium text-foreground/70">
                  {{ panelSummary.parcelSelection.truncated ? "Yes" : "No" }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2 sm:col-span-2">
                <dt class="text-muted-foreground">Next Cursor</dt>
                <dd class="m-0 max-w-[18rem] truncate text-xs text-foreground/70">
                  {{ panelSummary.parcelSelection.nextCursor ?? "-" }}
                </dd>
              </div>
            </dl>

            <p v-if="props.isParcelsLoading" class="mt-2 text-xs text-muted-foreground">
              Refreshing parcels…
            </p>
          </section>
        </div>
      </div>
    </section>

    <section
      v-else-if="hasCountyScores && activeTab === 'counties'"
      class="flex-1 overflow-auto rounded-sm border border-border bg-card p-2 shadow-xs"
    >
      <SpatialAnalysisCountyScoresSection
        :county-scores="countyScores"
        :error-message="countyScoresError"
        :county-scores-status="countyScoresStatus"
        :status-error-message="countyScoresStatusError"
      />
    </section>

    <section
      v-else-if="hasFacilities && activeTab === 'facilities'"
      class="flex-1 overflow-auto rounded-sm border border-border bg-card shadow-xs"
    >
      <SpatialAnalysisFacilitiesTable
        :facilities="orderedFacilities"
        :format-power="props.formatFacilityPower"
        :lease-semantic="props.leaseSemantic ?? false"
        :perspective-display="props.facilitiesPerspectiveDisplay ?? 'badge'"
        :power-heading="props.facilitiesPowerHeading ?? 'Power'"
        :show-coordinates="props.showCoordinates ?? false"
        @select-facility="emit('select-facility', $event)"
      />
    </section>

    <section
      v-else-if="hasParcels && activeTab === 'parcels'"
      class="flex-1 overflow-auto rounded-sm border border-border bg-card shadow-xs"
    >
      <SpatialAnalysisParcelTable :parcels="orderedParcels" />
    </section>

    <section
      v-else
      class="flex-1 rounded-sm border border-dashed border-border bg-card px-3 py-6 text-center text-xs text-muted-foreground shadow-xs"
    >
      {{ props.emptyMessage }}
    </section>

    <footer class="mt-3 flex items-center gap-2">
      <Button
        variant="glass-active"
        class="flex-1"
        :disabled="props.dashboardDisabled"
        @click="emit('open-dashboard')"
      >
        <LayoutDashboard class="h-3.5 w-3.5" />
        {{ props.dashboardLabel }}
      </Button>
      <Button variant="glass" :disabled="props.exportDisabled" @click="emit('export')">
        <Download class="h-3.5 w-3.5" />
        {{ props.exportLabel }}
      </Button>
      <Button variant="glass" @click="emit('dismiss')"> {{ props.dismissLabel }} </Button>
    </footer>
  </aside>
</template>
