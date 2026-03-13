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
  <article class="space-y-4 p-3">
    <!-- Header row -->
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-[#0EA5E9]" />
          <h3 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Overview</h3>
        </div>
        <p class="m-0 text-[10px] text-[#94A3B8]">
          Power, provider mix, parcel candidates, and facility preview.
        </p>
      </div>
      <div class="text-right">
        <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Facilities</div>
        <div class="text-sm font-semibold text-[#64748B]">{{ metrics.totalFacilities }}</div>
      </div>
    </div>

    <!-- Key metrics — flat grid, no card wrappers -->
    <div class="grid gap-x-4 gap-y-2 text-[10px] sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Colocation</div>
        <div class="text-lg font-semibold text-[#64748B]">{{ metrics.colocationCount }}</div>
        <div class="text-[#94A3B8]">
          {{ props.formatPower(metrics.colocationCommissionedPowerMw) }} commissioned
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Hyperscale</div>
        <div class="text-lg font-semibold text-[#64748B]">{{ metrics.hyperscaleCount }}</div>
        <div class="text-[#94A3B8]">
          {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }} commissioned
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Avg MW / Facility</div>
        <div class="text-lg font-semibold text-[#64748B]">
          {{ metrics.totalFacilities > 0
              ? props.formatPower(metrics.averageCommissionedPowerMwPerFacility)
              : "-" }}
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Total Commissioned</div>
        <div class="text-lg font-semibold text-[#64748B]">
          {{ props.formatPower(metrics.totalCommissionedPowerMw) }}
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Pipeline Power</div>
        <div class="text-lg font-semibold text-[#64748B]">
          {{ props.formatPower(metrics.totalPipelinePowerMw) }}
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-[#94A3B8]">Total Space</div>
        <div class="text-lg font-semibold text-[#64748B]">
          {{ formatNullableSquareFootage(metrics.totalSquareFootage) }}
        </div>
      </div>
    </div>

    <!-- Commissioned Mix + Status Breakdown -->
    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-[#64748B]" />
          <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Commissioned Mix</h4>
        </div>
        <div class="grid gap-x-4 gap-y-1 text-[10px] sm:grid-cols-2">
          <div>
            <div class="uppercase tracking-wide text-[#94A3B8]">Colocation</div>
            <div class="font-medium text-[#64748B]">
              {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
            </div>
            <div class="text-[#94A3B8]">
              {{ metrics.colocationCount }} facilities ·
              {{ props.formatPower(metrics.colocationPipelinePowerMw) }} pipe
            </div>
          </div>
          <div>
            <div class="uppercase tracking-wide text-[#94A3B8]">Hyperscale</div>
            <div class="font-medium text-[#64748B]">
              {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
            </div>
            <div class="text-[#94A3B8]">
              {{ metrics.hyperscaleCount }} facilities ·
              {{ props.formatPower(metrics.hyperscalePipelinePowerMw) }} pipe
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-[#10B981]" />
          <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Status Breakdown</h4>
        </div>

        <div v-if="statusItems.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="item in statusItems"
            :key="item.label"
            class="inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[10px] font-medium"
            :class="statusToneClass(item.tone)"
          >
            {{ item.label }} · {{ item.count }}
          </span>
        </div>

        <p v-else class="text-[10px] text-[#94A3B8]">No status totals available.</p>
      </section>
    </div>

    <hr class="border-t border-border/50" />

    <!-- Top Providers + Parcel Candidates -->
    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-[#8B5CF6]" />
          <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Top Providers</h4>
        </div>

        <div v-if="providers.length > 0" class="space-y-1.5">
          <div v-for="provider in providers" :key="provider.providerId ?? provider.providerName">
            <div class="flex items-center justify-between gap-2 text-[10px]">
              <span class="truncate font-medium text-[#64748B]">{{ provider.providerName }}</span>
              <span class="shrink-0 text-[#94A3B8]">
                {{ provider.count }} · {{ props.formatPower(provider.commissionedPowerMw) }}
              </span>
            </div>
          </div>
        </div>

        <p v-else class="text-[10px] text-[#94A3B8]">No provider totals available.</p>
      </section>

      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-[#10B981]" />
          <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Parcel Candidates</h4>
        </div>

        <div class="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
          <div>
            <span class="text-[#94A3B8]">Total acres:</span>
            <span class="font-medium tabular-nums text-[#64748B]">
              {{ formatNullableAcres(parcelCandidates.totalAcres) }}
            </span>
          </div>
          <div>
            <span class="text-[#94A3B8]">Avg acres:</span>
            <span class="font-medium tabular-nums text-[#64748B]">
              {{ formatNullableAcres(parcelCandidates.averageAcres) }}
            </span>
          </div>
          <div>
            <span class="text-[#94A3B8]">Max acres:</span>
            <span class="font-medium tabular-nums text-[#64748B]">
              {{ formatNullableAcres(parcelCandidates.maxAcres) }}
            </span>
          </div>
        </div>

        <div v-if="parcelCandidates.sample.length > 0" class="mt-2 space-y-1">
          <div
            v-for="(parcel, index) in parcelCandidates.sample"
            :key="`${parcel.parcelNumber ?? parcel.address ?? 'parcel'}-${String(index)}`"
            class="border-t border-[#E2E8F0]/60 pt-1 text-[10px]"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium text-[#64748B]">
                {{ parcel.address ?? parcel.parcelNumber ?? "Parcel" }}
              </span>
              <span class="tabular-nums text-[#94A3B8]">
                {{ parcel.acres === null ? "-" : `${formatNullableAcres(parcel.acres)} ac` }}
              </span>
            </div>
            <div class="truncate text-[10px] text-[#94A3B8]">
              {{ [parcel.county, parcel.state].filter(Boolean).join(", ") || "Location unavailable" }}
              {{ parcel.owner === null ? "" : ` · ${parcel.owner}` }}
            </div>
          </div>
        </div>

        <p v-else class="mt-2 text-[10px] text-[#94A3B8]">No parcel samples available.</p>
      </section>
    </div>

    <!-- Facilities preview -->
    <section>
      <div class="mb-2 flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-[#64748B]" />
        <h4 class="m-0 text-[10px] font-semibold text-[#94A3B8]">Facilities</h4>
      </div>

      <div v-if="facilityPreview.length > 0" class="space-y-1">
        <button
          v-for="facility in facilityPreview"
          :key="`${facility.perspective}:${facility.facilityId}`"
          type="button"
          class="flex w-full items-start justify-between gap-2 rounded-[4px] border border-[#E2E8F0] px-2 py-1.5 text-left text-[10px] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
          @click="selectFacility(facility)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1 truncate pr-2">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="facility.perspective === 'colocation' ? 'bg-cyan-500' : 'bg-amber-500'"
              />
              <span class="truncate font-medium text-[#64748B]">{{ facility.facilityName }}</span>
            </div>
            <div class="mt-0.5 truncate text-[10px] text-[#94A3B8]">
              {{ facility.providerName }}
            </div>
            <div class="mt-0.5 truncate text-[10px] text-[#94A3B8]">
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
