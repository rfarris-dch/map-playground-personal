<script setup lang="ts">
  import type { CountyScoresStatusResponse } from "@map-migration/contracts";
  import { computed } from "vue";

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
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-950"
      : "border-amber-400/40 bg-amber-500/10 text-amber-950"
  );
  const statusLabel = computed(() =>
    props.status?.datasetAvailable ? "Published intelligence dataset" : "Publication unavailable"
  );

  function formatFeatureFamily(value: string): string {
    return value
      .split("_")
      .map((part) => {
        const normalized = part.trim();
        if (normalized.length === 0) {
          return normalized;
        }

        return `${normalized[0]?.toUpperCase() ?? ""}${normalized.slice(1)}`;
      })
      .join(" ");
  }

  function formatDateTime(value: string | null): string {
    if (value === null) {
      return "-";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  }
</script>

<template>
  <section class="space-y-3 rounded-lg border border-border/60 bg-card/70 p-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="m-0 text-sm font-semibold">Dataset Status</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          Publication metadata, versioning, and feature-family coverage for county intelligence.
        </p>
      </div>

      <div
        v-if="props.status !== null"
        class="rounded-full border px-2.5 py-1 text-[11px] font-medium"
        :class="statusToneClass"
      >
        {{ statusLabel }}
      </div>
    </div>

    <p
      v-if="props.errorMessage"
      class="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-950"
    >
      {{ props.errorMessage }}
    </p>

    <div
      v-else-if="props.isLoading"
      class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div v-for="index in 6" :key="index" class="h-16 animate-pulse rounded-md bg-muted/80" />
    </div>

    <div v-else-if="props.status !== null" class="space-y-3">
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Published</div>
          <div class="mt-1 text-sm font-semibold">
            {{ formatDateTime(props.status.publishedAt) }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Data Version</div>
          <div class="mt-1 break-all text-sm font-semibold">
            {{ props.status.dataVersion ?? "-" }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Formula Version
          </div>
          <div class="mt-1 break-all text-sm font-semibold">
            {{ props.status.formulaVersion ?? "-" }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">Methodology</div>
          <div class="mt-1 break-all text-sm font-semibold">
            {{ props.status.methodologyId ?? "-" }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Publication Run
          </div>
          <div class="mt-1 break-all font-mono text-[11px] font-semibold">
            {{ props.status.publicationRunId ?? "-" }}
          </div>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Scored vs Source Counties
          </div>
          <div class="mt-1 text-sm font-semibold">
            {{ props.status.scoredCountyCount }}
            / {{ props.status.sourceCountyCount }}
          </div>
        </div>
      </div>

      <dl class="grid gap-2 text-xs sm:grid-cols-2">
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <dt class="text-[10px] uppercase tracking-wide text-muted-foreground">Input Data</dt>
          <dd class="mt-1 break-all text-[11px] font-medium">
            {{ props.status.inputDataVersion ?? "-" }}
          </dd>
        </div>
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <dt class="text-[10px] uppercase tracking-wide text-muted-foreground">Water Coverage</dt>
          <dd class="mt-1 text-[11px] font-medium">
            {{ props.status.waterCoverageCount }}
            counties with basin coverage
          </dd>
        </div>
      </dl>

      <div class="grid gap-2 text-xs lg:grid-cols-2">
        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Available Feature Families
          </div>
          <p class="mt-1 mb-0 text-[11px] font-medium">
            {{ availableFeatureFamilies.length > 0
                ? availableFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "-" }}
          </p>
        </div>

        <div class="rounded-md border border-border/60 bg-background/70 px-3 py-2">
          <div class="text-[10px] uppercase tracking-wide text-muted-foreground">
            Missing Feature Families
          </div>
          <p class="mt-1 mb-0 text-[11px] font-medium">
            {{ missingFeatureFamilies.length > 0
                ? missingFeatureFamilies.map(formatFeatureFamily).join(", ")
                : "None" }}
          </p>
        </div>
      </div>
    </div>

    <p
      v-else
      class="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-muted-foreground"
    >
      County intelligence publication metadata is not available for this selection.
    </p>
  </section>
</template>
