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
  const providerMaxPower = computed(() =>
    providers.value.reduce((maxPower, provider) => {
      return Math.max(maxPower, provider.commissionedPowerMw);
    }, 0)
  );
  const statusItems = computed(() =>
    buildSpatialAnalysisOverviewStatusItems(props.summary, props.facilities)
  );
  const facilityPreview = computed(() => props.facilities.slice(0, 8));

  function providerBarWidth(powerMw: number): string {
    if (providerMaxPower.value <= 0) {
      return "0%";
    }

    return `${String(Math.max(10, Math.round((powerMw / providerMaxPower.value) * 100)))}%`;
  }

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

  function statusToneClass(tone: string): string {
    if (tone === "emerald") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800";
    }

    if (tone === "amber") {
      return "border-amber-500/30 bg-amber-500/10 text-amber-800";
    }

    if (tone === "cyan") {
      return "border-cyan-500/30 bg-cyan-500/10 text-cyan-800";
    }

    if (tone === "rose") {
      return "border-rose-500/30 bg-rose-500/10 text-rose-800";
    }

    return "border-slate-500/30 bg-slate-500/10 text-slate-800";
  }
</script>

<template>
  <article class="map-glass-card rounded-lg p-3">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div>
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500" />
          <h3 class="m-0 text-xs font-semibold text-sky-700">Overview</h3>
        </div>
        <p class="m-0 text-[11px] text-muted-foreground">
          Power, provider mix, parcel candidates, and facility preview.
        </p>
      </div>
      <div class="map-glass-card rounded-md px-2 py-1 text-right">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Facilities</div>
        <div class="text-sm font-semibold text-foreground/90">{{ metrics.totalFacilities }}</div>
      </div>
    </div>

    <div class="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-md border border-cyan-500/20 bg-cyan-500/10 p-2">
        <div class="text-[10px] uppercase tracking-wide text-cyan-800">Colocation</div>
        <div class="text-lg font-semibold text-cyan-950">{{ metrics.colocationCount }}</div>
        <div class="text-[11px] text-cyan-900/80">
          {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div class="rounded-md border border-amber-500/20 bg-amber-500/10 p-2">
        <div class="text-[10px] uppercase tracking-wide text-amber-800">Hyperscale</div>
        <div class="text-lg font-semibold text-amber-950">{{ metrics.hyperscaleCount }}</div>
        <div class="text-[11px] text-amber-900/80">
          {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div class="map-glass-card rounded-md p-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
          Avg MW / Facility
        </div>
        <div class="text-lg font-semibold text-foreground/90">
          {{ metrics.totalFacilities > 0
              ? props.formatPower(metrics.averageCommissionedPowerMwPerFacility)
              : "-" }}
        </div>
      </div>

      <div class="map-glass-card rounded-md p-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
          Total Commissioned
        </div>
        <div class="text-lg font-semibold text-foreground/90">
          {{ props.formatPower(metrics.totalCommissionedPowerMw) }}
        </div>
      </div>

      <div class="map-glass-card rounded-md p-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Pipeline Power</div>
        <div class="text-lg font-semibold text-foreground/90">
          {{ props.formatPower(metrics.totalPipelinePowerMw) }}
        </div>
      </div>

      <div class="map-glass-card rounded-md p-2">
        <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Total Space</div>
        <div class="text-lg font-semibold text-foreground/90">
          {{ formatNullableSquareFootage(metrics.totalSquareFootage) }}
        </div>
      </div>
    </div>

    <div class="mb-3 grid gap-3 lg:grid-cols-2">
      <section class="map-glass-card rounded-md p-2">
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
          <h4 class="m-0 text-[11px] font-semibold text-foreground/90">Commissioned Mix</h4>
        </div>
        <div class="grid gap-2 text-[11px] sm:grid-cols-2">
          <div class="rounded bg-cyan-500/10 px-2 py-1.5">
            <div class="text-[10px] uppercase tracking-wide text-cyan-800">Colocation</div>
            <div class="font-medium text-cyan-950">
              {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
            </div>
            <div class="text-cyan-900/80">
              {{ metrics.colocationCount }}
              facilities ·
              {{ props.formatPower(metrics.colocationPipelinePowerMw) }}
              pipe
            </div>
          </div>
          <div class="rounded bg-amber-500/10 px-2 py-1.5">
            <div class="text-[10px] uppercase tracking-wide text-amber-800">Hyperscale</div>
            <div class="font-medium text-amber-950">
              {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
            </div>
            <div class="text-amber-900/80">
              {{ metrics.hyperscaleCount }}
              facilities ·
              {{ props.formatPower(metrics.hyperscalePipelinePowerMw) }}
              pipe
            </div>
          </div>
        </div>
      </section>

      <section class="map-glass-card rounded-md p-2">
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <h4 class="m-0 text-[11px] font-semibold text-foreground/90">Status Breakdown</h4>
        </div>

        <div v-if="statusItems.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="item in statusItems"
            :key="item.label"
            class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
            :class="statusToneClass(item.tone)"
          >
            {{ item.label }}
            · {{ item.count }}
          </span>
        </div>

        <p v-else class="text-[10px] text-muted-foreground">No status totals available.</p>
      </section>
    </div>

    <div class="mb-3 grid gap-3 lg:grid-cols-2">
      <section class="map-glass-card rounded-md p-2">
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
          <h4 class="m-0 text-[11px] font-semibold text-foreground/90">Top Providers</h4>
        </div>

        <div v-if="providers.length > 0" class="space-y-2">
          <div v-for="provider in providers" :key="provider.providerId ?? provider.providerName">
            <div class="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span class="truncate font-medium">{{ provider.providerName }}</span>
              <span class="shrink-0 text-muted-foreground">
                {{ provider.count }}
                · {{ props.formatPower(provider.commissionedPowerMw) }}
              </span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-violet-500/80"
                :style="{ width: providerBarWidth(provider.commissionedPowerMw) }"
              />
            </div>
          </div>
        </div>

        <p v-else class="text-[10px] text-muted-foreground">No provider totals available.</p>
      </section>

      <section class="map-glass-card rounded-md p-2">
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <h4 class="m-0 text-[11px] font-semibold text-foreground/90">Parcel Candidates</h4>
        </div>

        <div class="grid grid-cols-3 gap-2 text-[11px]">
          <div class="map-glass-card rounded px-2 py-1">
            <span class="text-muted-foreground">Total acres:</span>
            <span class="font-medium tabular-nums">
              {{ formatNullableAcres(parcelCandidates.totalAcres) }}
            </span>
          </div>
          <div class="map-glass-card rounded px-2 py-1">
            <span class="text-muted-foreground">Avg acres:</span>
            <span class="font-medium tabular-nums">
              {{ formatNullableAcres(parcelCandidates.averageAcres) }}
            </span>
          </div>
          <div class="map-glass-card rounded px-2 py-1">
            <span class="text-muted-foreground">Max acres:</span>
            <span class="font-medium tabular-nums">
              {{ formatNullableAcres(parcelCandidates.maxAcres) }}
            </span>
          </div>
        </div>

        <div v-if="parcelCandidates.sample.length > 0" class="mt-2 space-y-1">
          <div
            v-for="(parcel, index) in parcelCandidates.sample"
            :key="`${parcel.parcelNumber ?? parcel.address ?? 'parcel'}-${String(index)}`"
            class="map-glass-card rounded px-2 py-1.5 text-[11px]"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium">
                {{ parcel.address ?? parcel.parcelNumber ?? "Parcel" }}
              </span>
              <span class="tabular-nums text-muted-foreground">
                {{ parcel.acres === null ? "-" : `${formatNullableAcres(parcel.acres)} ac` }}
              </span>
            </div>
            <div class="truncate text-[10px] text-muted-foreground">
              {{ [parcel.county, parcel.state].filter(Boolean).join(", ") || "Location unavailable" }}
              {{ parcel.owner === null ? "" : ` · ${parcel.owner}` }}
            </div>
          </div>
        </div>

        <p v-else class="mt-2 text-[10px] text-muted-foreground">No parcel samples available.</p>
      </section>
    </div>

    <section class="map-glass-card rounded-md p-2">
      <div class="mb-1 flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
        <h4 class="m-0 text-[11px] font-semibold text-foreground/90">Facilities</h4>
      </div>

      <div v-if="facilityPreview.length > 0" class="space-y-1">
        <button
          v-for="facility in facilityPreview"
          :key="`${facility.perspective}:${facility.facilityId}`"
          type="button"
          class="map-glass-button flex w-full items-start justify-between gap-2 rounded px-2 py-1.5 text-left transition"
          @click="selectFacility(facility)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1 truncate pr-2">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="facility.perspective === 'colocation' ? 'bg-cyan-500' : 'bg-amber-500'"
              />
              <span class="truncate font-medium">{{ facility.facilityName }}</span>
            </div>
            <div class="mt-0.5 truncate text-[10px] text-muted-foreground">
              {{ facility.providerName }}
            </div>
            <div class="mt-0.5 truncate text-[10px] text-muted-foreground">
              {{ facilityLocationText(facility) }}
            </div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {{ toSpatialAnalysisPerspectiveLabel(facility.perspective) }}
              </span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {{ facilityStatusText(facility) }}
              </span>
            </div>
          </div>
          <div class="shrink-0 text-right text-[10px] text-muted-foreground">
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

      <p v-else class="text-[10px] text-muted-foreground">No facilities available.</p>
    </section>
  </article>
</template>
