<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import {
    toSpatialAnalysisPerspectiveLabel,
    toSpatialAnalysisSemanticLabel,
  } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
  import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
  import {
    buildSpatialAnalysisOverviewMetrics,
    buildSpatialAnalysisOverviewProviders,
    buildSpatialAnalysisOverviewStatusItems,
    buildSpatialAnalysisParcelCandidateSummary,
    type SpatialAnalysisOverviewSummary,
  } from "@/features/spatial-analysis/spatial-analysis-summary-overview.service";

  interface SpatialAnalysisSummaryOverviewProps {
    readonly facilities: readonly SpatialAnalysisFacilityRecord[];
    readonly formatPower: (powerMw: number) => string;
    readonly parcels: readonly SpatialAnalysisParcelRecord[];
    readonly summary: SpatialAnalysisOverviewSummary;
  }

  const props = defineProps<SpatialAnalysisSummaryOverviewProps>();
  const emit = defineEmits<{
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const metrics = computed(() => buildSpatialAnalysisOverviewMetrics(props.summary));
  const parcelCandidates = computed(() =>
    buildSpatialAnalysisParcelCandidateSummary(props.parcels)
  );
  const providers = computed(() => buildSpatialAnalysisOverviewProviders(props.summary, 8));
  const statusItems = computed(() =>
    buildSpatialAnalysisOverviewStatusItems(props.summary, props.facilities)
  );
  const facilityPreview = computed(() => props.facilities.slice(0, 8));

  function formatNullableAcres(value: number | null): string {
    if (value === null) {
      return "-";
    }

    return value.toLocaleString(undefined, {
      maximumFractionDigits: value >= 100 ? 0 : 1,
    });
  }

  function formatNullableSquareFootage(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
      return "-";
    }

    return `${Math.round(value).toLocaleString()} sf`;
  }

  function facilityLocationText(facility: SpatialAnalysisFacilityRecord): string {
    const parts = [facility.city, facility.state ?? facility.stateAbbrev].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    if (parts.length > 0) {
      return parts.join(", ");
    }

    if (typeof facility.address === "string" && facility.address.trim().length > 0) {
      return facility.address;
    }

    return "Location unavailable";
  }

  function facilityPipelinePowerMw(facility: SpatialAnalysisFacilityRecord): number {
    return (facility.plannedPowerMw ?? 0) + (facility.underConstructionPowerMw ?? 0);
  }

  function facilityStatusText(facility: SpatialAnalysisFacilityRecord): string {
    if (typeof facility.statusLabel === "string" && facility.statusLabel.trim().length > 0) {
      return facility.statusLabel;
    }

    return toSpatialAnalysisSemanticLabel(facility.commissionedSemantic);
  }

  function selectFacility(facility: SpatialAnalysisFacilityRecord): void {
    emit("select-facility", {
      facilityId: facility.facilityId,
      perspective: facility.perspective,
    });
  }

  const STATUS_TONE_MAP: Record<string, string> = {
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-800",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-800",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-800",
  };

  const STATUS_TONE_DEFAULT = "border-muted-foreground/30 bg-muted text-foreground/70";

  function statusToneClass(tone: string): string {
    return STATUS_TONE_MAP[tone] ?? STATUS_TONE_DEFAULT;
  }
</script>

<template>
  <article
    class="rounded-sm border border-border bg-card p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border"
  >
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500" />
          <h3 class="m-0 text-xs font-semibold text-muted-foreground">Overview</h3>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          Power, provider mix, parcel candidates, and facility preview.
        </p>
      </div>
      <div
        class="rounded-sm border border-border bg-card px-2 py-1 text-right shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Facilities</div>
        <div class="text-sm font-semibold text-foreground/70">{{ metrics.totalFacilities }}</div>
      </div>
    </div>

    <div class="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Colocation</div>
        <div class="text-lg font-semibold text-foreground/70">{{ metrics.colocationCount }}</div>
        <div class="text-xs text-muted-foreground">
          {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Hyperscale</div>
        <div class="text-lg font-semibold text-foreground/70">{{ metrics.hyperscaleCount }}</div>
        <div class="text-xs text-muted-foreground">
          {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Avg MW / Facility</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ metrics.totalFacilities > 0
              ? props.formatPower(metrics.averageCommissionedPowerMwPerFacility)
              : "-" }}
        </div>
      </div>

      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Total Commissioned</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ props.formatPower(metrics.totalCommissionedPowerMw) }}
        </div>
      </div>

      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Pipeline Power</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ props.formatPower(metrics.totalPipelinePowerMw) }}
        </div>
      </div>

      <div
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Total Space</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ formatNullableSquareFootage(metrics.totalSquareFootage) }}
        </div>
      </div>
    </div>

    <div class="mb-3 grid gap-3 lg:grid-cols-2">
      <section
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Commissioned Mix</h4>
        </div>
        <div class="grid gap-2 text-xs sm:grid-cols-2">
          <div class="rounded-sm border border-border bg-background px-2 py-1.5">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">Colocation</div>
            <div class="font-medium text-foreground/70">
              {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
            </div>
            <div class="text-muted-foreground">
              {{ metrics.colocationCount }}
              facilities ·
              {{ props.formatPower(metrics.colocationPipelinePowerMw) }}
              pipe
            </div>
          </div>
          <div class="rounded-sm border border-border bg-background px-2 py-1.5">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">Hyperscale</div>
            <div class="font-medium text-foreground/70">
              {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
            </div>
            <div class="text-muted-foreground">
              {{ metrics.hyperscaleCount }}
              facilities ·
              {{ props.formatPower(metrics.hyperscalePipelinePowerMw) }}
              pipe
            </div>
          </div>
        </div>
      </section>

      <section
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-hyperscale" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Status Breakdown</h4>
        </div>

        <div v-if="statusItems.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="item in statusItems"
            :key="item.label"
            class="inline-flex items-center rounded-sm border border-border bg-card px-2 py-0.5 text-xs font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            :class="statusToneClass(item.tone)"
          >
            {{ item.label }}
            · {{ item.count }}
          </span>
        </div>

        <p v-else class="text-xs text-muted-foreground">No status totals available.</p>
      </section>
    </div>

    <div class="mb-3 grid gap-3 lg:grid-cols-2">
      <section
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Top Providers</h4>
        </div>

        <div v-if="providers.length > 0" class="space-y-2">
          <div v-for="provider in providers" :key="provider.providerId ?? provider.providerName">
            <div class="mb-1 flex items-center justify-between gap-2 text-xs">
              <span class="truncate font-medium text-foreground/70">{{ provider.providerName }}</span>
              <span class="shrink-0 text-muted-foreground">
                {{ provider.count }}
                · {{ props.formatPower(provider.commissionedPowerMw) }}
              </span>
            </div>
          </div>
        </div>

        <p v-else class="text-xs text-muted-foreground">No provider totals available.</p>
      </section>

      <section
        class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
      >
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-hyperscale" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Parcel Candidates</h4>
        </div>

        <div class="grid grid-cols-3 gap-2 text-xs">
          <div
            class="rounded-sm border border-border bg-card px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span class="text-muted-foreground">Total acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.totalAcres) }}
            </span>
          </div>
          <div
            class="rounded-sm border border-border bg-card px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span class="text-muted-foreground">Avg acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.averageAcres) }}
            </span>
          </div>
          <div
            class="rounded-sm border border-border bg-card px-2 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span class="text-muted-foreground">Max acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.maxAcres) }}
            </span>
          </div>
        </div>

        <div v-if="parcelCandidates.sample.length > 0" class="mt-2 space-y-1">
          <div
            v-for="(parcel, index) in parcelCandidates.sample"
            :key="`${parcel.parcelNumber ?? parcel.address ?? 'parcel'}-${String(index)}`"
            class="rounded-sm border border-border bg-card px-2 py-1.5 text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium text-foreground/70">
                {{ parcel.address ?? parcel.parcelNumber ?? "Parcel" }}
              </span>
              <span class="tabular-nums text-muted-foreground">
                {{ parcel.acres === null ? "-" : `${formatNullableAcres(parcel.acres)} ac` }}
              </span>
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ [parcel.county, parcel.state].filter(Boolean).join(", ") || "Location unavailable" }}
              {{ parcel.owner === null ? "" : ` · ${parcel.owner}` }}
            </div>
          </div>
        </div>

        <p v-else class="mt-2 text-xs text-muted-foreground">No parcel samples available.</p>
      </section>
    </div>

    <section
      class="rounded-sm border border-border bg-card p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div class="mb-1 flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
        <h4 class="m-0 text-xs font-semibold text-muted-foreground">Facilities</h4>
      </div>

      <div v-if="facilityPreview.length > 0" class="space-y-1">
        <button
          v-for="facility in facilityPreview"
          :key="`${facility.perspective}:${facility.facilityId}`"
          type="button"
          class="flex w-full items-start justify-between gap-2 rounded-sm border border-border bg-card px-2 py-1.5 text-left text-xs shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-border hover:bg-background"
          @click="selectFacility(facility)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1 truncate pr-2">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="facility.perspective === 'colocation' ? 'bg-cyan-500' : 'bg-amber-500'"
              />
              <span class="truncate font-medium text-foreground/70">{{ facility.facilityName }}</span>
            </div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ facility.providerName }}
            </div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ facilityLocationText(facility) }}
            </div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ toSpatialAnalysisPerspectiveLabel(facility.perspective) }}
              </span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ facilityStatusText(facility) }}
              </span>
            </div>
          </div>
          <div class="shrink-0 text-right text-xs text-muted-foreground">
            <div class="font-medium text-foreground/90">
              {{ props.formatPower(facility.commissionedPowerMw ?? 0) }}
            </div>
            <div>Pipe {{ props.formatPower(facilityPipelinePowerMw(facility)) }}</div>
            <div>{{ formatNullableSquareFootage(facility.squareFootage ?? 0) }}</div>
            <div>
              {{ facility.leaseOrOwn === null
                  ? "-"
                  : toSpatialAnalysisSemanticLabel(facility.leaseOrOwn) }}
            </div>
          </div>
        </button>
      </div>

      <p v-else class="text-xs text-muted-foreground">No facilities available.</p>
    </section>
  </article>
</template>
