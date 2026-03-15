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
  const facilityPreview = computed(() =>
    props.facilities.slice(0, 8).map((facility) => ({
      ...facility,
      locationText: buildFacilityLocationText(facility),
      pipelinePowerMw: (facility.plannedPowerMw ?? 0) + (facility.underConstructionPowerMw ?? 0),
      statusText:
        typeof facility.statusLabel === "string" && facility.statusLabel.trim().length > 0
          ? facility.statusLabel
          : toSpatialAnalysisSemanticLabel(facility.commissionedSemantic),
      perspectiveLabel: toSpatialAnalysisPerspectiveLabel(facility.perspective),
      perspectiveDotClass:
        facility.perspective === "colocation" ? "bg-colocation" : "bg-hyperscale",
      formattedCommissioned: props.formatPower(facility.commissionedPowerMw ?? 0),
      formattedSquareFootage: formatNullableSquareFootage(facility.squareFootage ?? 0),
      leaseOrOwnLabel:
        facility.leaseOrOwn === null ? "-" : toSpatialAnalysisSemanticLabel(facility.leaseOrOwn),
    }))
  );

  const averagePowerDisplay = computed(() =>
    metrics.value.totalFacilities > 0
      ? props.formatPower(metrics.value.averageCommissionedPowerMwPerFacility)
      : "-"
  );

  const parcelCandidateRows = computed(() =>
    parcelCandidates.value.sample.map((parcel) => ({
      ...parcel,
      label: parcel.address ?? parcel.parcelNumber ?? "Parcel",
      acresDisplay: parcel.acres === null ? "-" : `${formatNullableAcres(parcel.acres)} ac`,
      locationDisplay:
        [parcel.county, parcel.state].filter(Boolean).join(", ") || "Location unavailable",
      ownerSuffix: parcel.owner === null ? "" : ` · ${parcel.owner}`,
    }))
  );

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

  function buildFacilityLocationText(facility: SpatialAnalysisFacilityRecord): string {
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
  <article class="space-y-4 p-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="mb-1 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-sky-500" />
          <h3 class="m-0 text-xs font-semibold text-muted-foreground">Overview</h3>
        </div>
        <p class="m-0 text-xs text-muted-foreground">
          Power, provider mix, parcel candidates, and facility preview.
        </p>
      </div>
      <div class="text-right">
        <div class="text-xs uppercase tracking-wide text-muted-foreground">Facilities</div>
        <div class="text-sm font-semibold text-foreground/70">{{ metrics.totalFacilities }}</div>
      </div>
    </div>

    <div class="grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2 xl:grid-cols-3">
      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Colocation</div>
        <div class="text-lg font-semibold text-foreground/70">{{ metrics.colocationCount }}</div>
        <div class="text-muted-foreground">
          {{ props.formatPower(metrics.colocationCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Hyperscale</div>
        <div class="text-lg font-semibold text-foreground/70">{{ metrics.hyperscaleCount }}</div>
        <div class="text-muted-foreground">
          {{ props.formatPower(metrics.hyperscaleCommissionedPowerMw) }}
          commissioned
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Avg MW / Facility</div>
        <div class="text-lg font-semibold text-foreground/70">{{ averagePowerDisplay }}</div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Total Commissioned</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ props.formatPower(metrics.totalCommissionedPowerMw) }}
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Pipeline Power</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ props.formatPower(metrics.totalPipelinePowerMw) }}
        </div>
      </div>

      <div>
        <div class="uppercase tracking-wide text-muted-foreground">Total Space</div>
        <div class="text-lg font-semibold text-foreground/70">
          {{ formatNullableSquareFootage(metrics.totalSquareFootage) }}
        </div>
      </div>
    </div>

    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Commissioned Mix</h4>
        </div>
        <div class="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div>
            <div class="uppercase tracking-wide text-muted-foreground">Colocation</div>
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
          <div>
            <div class="uppercase tracking-wide text-muted-foreground">Hyperscale</div>
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

      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-hyperscale" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Status Breakdown</h4>
        </div>

        <div v-if="statusItems.length > 0" class="flex flex-wrap gap-1.5">
          <span
            v-for="item in statusItems"
            :key="item.label"
            class="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium"
            :class="statusToneClass(item.tone)"
          >
            {{ item.label }}
            · {{ item.count }}
          </span>
        </div>

        <p v-else class="text-xs text-muted-foreground">No status totals available.</p>
      </section>
    </div>

    <hr class="border-t border-border/50">

    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-violet-500" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Top Providers</h4>
        </div>

        <div v-if="providers.length > 0" class="space-y-1.5">
          <div v-for="provider in providers" :key="provider.providerId ?? provider.providerName">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="truncate font-medium text-foreground/70"
                >{{ provider.providerName }}</span
              >
              <span class="shrink-0 text-muted-foreground">
                {{ provider.count }}
                · {{ props.formatPower(provider.commissionedPowerMw) }}
              </span>
            </div>
          </div>
        </div>

        <p v-else class="text-xs text-muted-foreground">No provider totals available.</p>
      </section>

      <section>
        <div class="mb-2 flex items-center gap-1.5">
          <span class="inline-block h-2 w-2 rounded-full bg-hyperscale" />
          <h4 class="m-0 text-xs font-semibold text-muted-foreground">Parcel Candidates</h4>
        </div>

        <div class="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
          <div>
            <span class="text-muted-foreground">Total acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.totalAcres) }}
            </span>
          </div>
          <div>
            <span class="text-muted-foreground">Avg acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.averageAcres) }}
            </span>
          </div>
          <div>
            <span class="text-muted-foreground">Max acres:</span>
            <span class="font-medium tabular-nums text-foreground/70">
              {{ formatNullableAcres(parcelCandidates.maxAcres) }}
            </span>
          </div>
        </div>

        <div v-if="parcelCandidateRows.length > 0" class="mt-2 space-y-1">
          <div
            v-for="(parcel, index) in parcelCandidateRows"
            :key="`${parcel.parcelNumber ?? parcel.address ?? 'parcel'}-${String(index)}`"
            class="border-t border-border/60 pt-1 text-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate font-medium text-foreground/70"> {{ parcel.label }} </span>
              <span class="tabular-nums text-muted-foreground"> {{ parcel.acresDisplay }} </span>
            </div>
            <div class="truncate text-xs text-muted-foreground">
              {{ parcel.locationDisplay }}{{ parcel.ownerSuffix }}
            </div>
          </div>
        </div>

        <p v-else class="mt-2 text-xs text-muted-foreground">No parcel samples available.</p>
      </section>
    </div>

    <section>
      <div class="mb-2 flex items-center gap-1.5">
        <span class="inline-block h-2 w-2 rounded-full bg-slate-500" />
        <h4 class="m-0 text-xs font-semibold text-muted-foreground">Facilities</h4>
      </div>

      <div v-if="facilityPreview.length > 0" class="space-y-1">
        <button
          v-for="facility in facilityPreview"
          :key="`${facility.perspective}:${facility.facilityId}`"
          type="button"
          class="flex w-full items-start justify-between gap-2 rounded-sm border border-border px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-background"
          @click="selectFacility(facility)"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-1 truncate pr-2">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="facility.perspectiveDotClass"
              />
              <span class="truncate font-medium text-foreground/70"
                >{{ facility.facilityName }}</span
              >
            </div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ facility.providerName }}
            </div>
            <div class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ facility.locationText }}
            </div>
            <div class="mt-0.5 flex flex-wrap gap-1">
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ facility.perspectiveLabel }}
              </span>
              <span class="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {{ facility.statusText }}
              </span>
            </div>
          </div>
          <div class="shrink-0 text-right text-xs text-muted-foreground">
            <div class="font-medium text-foreground/90">{{ facility.formattedCommissioned }}</div>
            <div>Pipe {{ props.formatPower(facility.pipelinePowerMw) }}</div>
            <div>{{ facility.formattedSquareFootage }}</div>
            <div>{{ facility.leaseOrOwnLabel }}</div>
          </div>
        </button>
      </div>

      <p v-else class="text-xs text-muted-foreground">No facilities available.</p>
    </section>
  </article>
</template>
