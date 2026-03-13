<script setup lang="ts">
  import type { CountyScoresStatusResponse } from "@map-migration/contracts";
  import { computed } from "vue";
  import {
    formatDateTime,
    formatFeatureFamily,
  } from "@/features/county-scores/county-scores-display.service";

  interface CountyScoresDatasetStatusProps {
    readonly errorMessage?: string | null;
    readonly isLoading?: boolean;
    readonly status: CountyScoresStatusResponse | null;
  }

  const props = defineProps<CountyScoresDatasetStatusProps>();

  const availableFeatureFamilies = computed(() => props.status?.availableFeatureFamilies ?? []);
  const missingFeatureFamilies = computed(() => props.status?.missingFeatureFamilies ?? []);
  const statusToneClass = computed(() =>
    props.status?.datasetAvailable
      ? "border-[#E2E8F0] bg-white text-[#64748B]"
      : "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
  );
  const statusLabel = computed(() =>
    props.status?.datasetAvailable ? "Published market-pressure dataset" : "Publication unavailable"
  );
  const confidenceSummary = computed(() => {
    if (props.status === null) {
      return "-";
    }

    return `${props.status.highConfidenceCount} high / ${props.status.mediumConfidenceCount} medium / ${props.status.lowConfidenceCount} low`;
  });
</script>

<template>
  <section
    class="space-y-3 rounded-[4px] border border-[#E2E8F0] bg-white p-3 text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="m-0 text-[10px] font-semibold text-[#64748B]">Dataset Status</h3>
        <p class="mt-1 text-[10px] text-[#94A3B8]">
          Publication metadata, freshness, confidence, and source-family coverage for county market
          pressure.
        </p>
      </div>

      <div
        v-if="props.status !== null"
        class="rounded-[4px] border px-2.5 py-1 text-[10px] font-medium shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        :class="statusToneClass"
      >
        {{ statusLabel }}
      </div>
    </div>

    <p
      v-if="props.errorMessage"
      class="rounded-[4px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[10px] text-[#B91C1C]"
    >
      {{ props.errorMessage }}
    </p>

    <div
      v-else-if="props.isLoading"
      class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div v-for="index in 8" :key="index" class="h-16 animate-pulse rounded-[4px] bg-[#F1F5F9]" />
    </div>

    <div v-else-if="props.status !== null" class="space-y-3">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Published</div>
          <div class="mt-1 text-sm font-semibold text-[#64748B]">
            {{ formatDateTime(props.status.publishedAt) }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Data Version</div>
          <div class="mt-1 break-all text-sm font-semibold text-[#64748B]">
            {{ props.status.dataVersion ?? "-" }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Formula Version
          </div>
          <div class="mt-1 break-all text-sm font-semibold text-[#64748B]">
            {{ props.status.formulaVersion ?? "-" }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Methodology</div>
          <div class="mt-1 break-all text-sm font-semibold text-[#64748B]">
            {{ props.status.methodologyId ?? "-" }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Publication Run
          </div>
          <div class="mt-1 break-all text-[10px] font-semibold text-[#64748B]">
            {{ props.status.publicationRunId ?? "-" }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Ranked / Deferred / Blocked
          </div>
          <div class="mt-1 text-sm font-semibold text-[#64748B]">
            {{ props.status.rankedCountyCount }}
            / {{ props.status.deferredCountyCount }}
            / {{ props.status.blockedCountyCount }}
          </div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Confidence</div>
          <div class="mt-1 text-sm font-semibold text-[#64748B]">{{ confidenceSummary }}</div>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Fresh Counties
          </div>
          <div class="mt-1 text-sm font-semibold text-[#64748B]">
            {{ props.status.freshCountyCount }}
            / {{ props.status.sourceCountyCount }}
          </div>
        </div>
      </div>

      <dl class="grid gap-2 text-xs sm:grid-cols-2">
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <dt class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Input Data</dt>
          <dd class="mt-1 break-all text-[10px] font-medium text-[#64748B]">
            {{ props.status.inputDataVersion ?? "-" }}
          </dd>
        </div>
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <dt class="text-[10px] uppercase tracking-wide text-[#94A3B8]">Rows Published</dt>
          <dd class="mt-1 text-[10px] font-medium text-[#64748B]">
            {{ props.status.rowCount }}
            current county rows
          </dd>
        </div>
      </dl>

      <div class="grid gap-2 text-xs lg:grid-cols-2">
        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Available Feature Families
          </div>
          <p class="mt-1 mb-0 text-[10px] font-medium text-[#64748B]">
            {{ availableFeatureFamilies.length > 0
                ? availableFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "-" }}
          </p>
        </div>

        <div
          class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Missing Feature Families
          </div>
          <p class="mt-1 mb-0 text-[10px] font-medium text-[#64748B]">
            {{ missingFeatureFamilies.length > 0
                ? missingFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "None" }}
          </p>
        </div>
      </div>
    </div>

    <p
      v-else
      class="rounded-[4px] border border-[#E2E8F0] bg-white px-3 py-2 text-[10px] text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      County market-pressure publication metadata is not available for this selection.
    </p>
  </section>
</template>
