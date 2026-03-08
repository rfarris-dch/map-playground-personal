<script setup lang="ts">
  import { computed } from "vue";
  import { RouterLink } from "vue-router";
  import { buildGlobalMapRoute } from "@/features/navigation/navigation.service";
  import SpatialAnalysisFacilitiesTable from "@/features/spatial-analysis/components/spatial-analysis-facilities-table.vue";
  import SpatialAnalysisParcelTable from "@/features/spatial-analysis/components/spatial-analysis-parcel-table.vue";
  import SpatialAnalysisPerspectiveCard from "@/features/spatial-analysis/components/spatial-analysis-perspective-card.vue";
  import type { SpatialAnalysisDashboardState } from "@/features/spatial-analysis/spatial-analysis-dashboard.types";
  import {
    buildSpatialAnalysisOverviewMetrics,
    buildSpatialAnalysisOverviewProviders,
    buildSpatialAnalysisOverviewStatusItems,
  } from "@/features/spatial-analysis/spatial-analysis-summary-overview.service";

  interface SpatialAnalysisDashboardProps {
    readonly state: SpatialAnalysisDashboardState | null;
  }

  const props = defineProps<SpatialAnalysisDashboardProps>();

  const summary = computed(() => props.state?.summary.summary ?? null);
  const metrics = computed(() =>
    summary.value === null ? null : buildSpatialAnalysisOverviewMetrics(summary.value)
  );
  const statusItems = computed(() =>
    summary.value === null ? [] : buildSpatialAnalysisOverviewStatusItems(summary.value)
  );
  const providers = computed(() =>
    summary.value === null ? [] : buildSpatialAnalysisOverviewProviders(summary.value, 8)
  );
  const mapReturnRoute = computed(() => buildGlobalMapRoute(props.state?.mapContext));

  function formatPower(powerMw: number | null): string {
    if (powerMw === null) {
      return "0.0 MW";
    }

    if (!Number.isFinite(powerMw) || powerMw <= 0) {
      return "0.0 MW";
    }

    if (powerMw >= 1000) {
      return `${(powerMw / 1000).toFixed(1)} GW`;
    }

    return `${powerMw.toFixed(1)} MW`;
  }

  function formatInteger(value: number): string {
    return Math.round(value).toLocaleString();
  }

  function formatAveragePower(powerMw: number): string {
    return formatPower(powerMw);
  }

  function statusToneClass(tone: string): string {
    if (tone === "emerald") {
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
    }

    if (tone === "amber") {
      return "border-amber-500/25 bg-amber-500/10 text-amber-800";
    }

    if (tone === "cyan") {
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-800";
    }

    if (tone === "rose") {
      return "border-rose-500/25 bg-rose-500/10 text-rose-800";
    }

    return "border-slate-500/25 bg-slate-500/10 text-slate-800";
  }
</script>

<template>
  <section
    v-if="props.state !== null && summary !== null && metrics !== null"
    class="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5"
  >
    <header class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 class="m-0 text-2xl font-semibold tracking-tight">{{ props.state.title }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Source:
          {{ props.state.source === "selection" ? "Select Area" : "Scanner" }}
          <span v-if="props.state.isFiltered"> · Filtered viewport</span>
          · Created {{ new Date(props.state.createdAt).toLocaleString() }}
        </p>
      </div>

      <RouterLink
        :to="mapReturnRoute"
        class="inline-flex h-9 items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Back to Map
      </RouterLink>
    </header>

    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Facilities</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">{{ metrics.totalFacilities }}</p>
      </article>
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Colocation</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">{{ metrics.colocationCount }}</p>
      </article>
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Hyperscale</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">{{ metrics.hyperscaleCount }}</p>
      </article>
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Commissioned</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">
          {{ formatPower(metrics.totalCommissionedPowerMw) }}
        </p>
      </article>
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <p class="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Pipeline</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums">
          {{ formatPower(metrics.totalPipelinePowerMw) }}
        </p>
      </article>
    </section>

    <section class="grid gap-4 lg:grid-cols-2">
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <h2 class="m-0 text-sm font-semibold">Selection Summary</h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Total commissioned</dt>
            <dd class="m-0 font-medium tabular-nums">
              {{ formatPower(metrics.totalCommissionedPowerMw) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Total pipeline</dt>
            <dd class="m-0 font-medium tabular-nums">
              {{ formatPower(metrics.totalPipelinePowerMw) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Average MW / facility</dt>
            <dd class="m-0 font-medium tabular-nums">
              {{ formatAveragePower(metrics.averageCommissionedPowerMwPerFacility) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Total square footage</dt>
            <dd class="m-0 font-medium tabular-nums">
              {{ formatInteger(metrics.totalSquareFootage) }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Parcels</dt>
            <dd class="m-0 font-medium tabular-nums">
              {{ summary.parcelSelection.count.toLocaleString() }}
            </dd>
          </div>
        </dl>
      </article>

      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <h2 class="m-0 text-sm font-semibold">Top Providers / Users</h2>
        <div class="mt-3 space-y-2 text-sm">
          <p v-if="providers.length === 0" class="text-muted-foreground">
            No provider data in this selection.
          </p>
          <div
            v-for="provider in providers"
            :key="provider.providerId ?? provider.providerName"
            class="flex items-center justify-between gap-3"
          >
            <span class="truncate">{{ provider.providerName }}</span>
            <span class="tabular-nums text-muted-foreground">
              {{ provider.count }}
              · {{ formatPower(provider.commissionedPowerMw) }}
            </span>
          </div>
        </div>
      </article>
    </section>

    <section class="grid gap-4 xl:grid-cols-[1.35fr_1fr_1fr]">
      <article class="rounded-xl border border-border/70 bg-card/95 p-4 shadow-sm">
        <h2 class="m-0 text-sm font-semibold">Status Breakdown</h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="item in statusItems"
            :key="item.label"
            class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
            :class="statusToneClass(item.tone)"
          >
            {{ item.label }}
            · {{ item.count }}
          </span>
        </div>
      </article>

      <SpatialAnalysisPerspectiveCard
        v-if="summary.colocation.count > 0"
        title="Colocation"
        accent="colocation"
        :summary="summary.colocation"
        :providers="summary.topColocationProviders"
        :format-power="formatPower"
        power-label="Commissioned"
      />

      <SpatialAnalysisPerspectiveCard
        v-if="summary.hyperscale.count > 0"
        title="Hyperscale"
        accent="hyperscale"
        :summary="summary.hyperscale"
        :providers="summary.topHyperscaleProviders"
        :format-power="formatPower"
        power-label="Commissioned"
      />
    </section>

    <article class="overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm">
      <header class="border-b border-border/60 px-4 py-3">
        <h2 class="m-0 text-sm font-semibold">
          Facilities ({{ summary.facilities.length.toLocaleString() }})
        </h2>
      </header>

      <div class="overflow-x-auto">
        <SpatialAnalysisFacilitiesTable
          :facilities="summary.facilities"
          :format-power="formatPower"
          power-heading="Comm/Owned"
          perspective-display="badge"
          :interactive="false"
        />
      </div>
    </article>

    <article
      v-if="summary.parcelSelection.count > 0"
      class="overflow-hidden rounded-xl border border-border/70 bg-card/95 shadow-sm"
    >
      <header class="border-b border-border/60 px-4 py-3">
        <h2 class="m-0 text-sm font-semibold">
          Parcels ({{ summary.parcelSelection.count.toLocaleString() }})
        </h2>
      </header>

      <div class="overflow-x-auto">
        <SpatialAnalysisParcelTable
          :parcels="summary.parcelSelection.parcels"
          :rows-per-page="100"
        />
      </div>
    </article>
  </section>

  <section v-else class="mx-auto flex h-full w-full max-w-5xl flex-col gap-4 px-4 py-8">
    <h1 class="m-0 text-2xl font-semibold">Selection Dashboard</h1>
    <p class="text-sm text-muted-foreground">
      No active selection found. Open Scanner or Select Area on the map first.
    </p>
    <div>
      <RouterLink
        :to="mapReturnRoute"
        class="inline-flex h-9 items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Back to Map
      </RouterLink>
    </div>
  </section>
</template>
