<script setup lang="ts">
  import { ArrowRight, ChevronDown, Download, Maximize2, Minus, X } from "lucide-vue-next";
  import { nextTick, ref, watch } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import { useGsapStagger } from "@/composables/use-gsap-stagger";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import { formatScannerPowerMw } from "@/features/scanner/scanner.service";
  import { type ScannerPanelProps, useScannerPanelModel } from "./use-scanner-panel-model";

  const props = defineProps<ScannerPanelProps>();
  const emit = defineEmits<{
    close: [];
    export: [];
    "open-dashboard": [];
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const {
    activeTab,
    minimized,
    topCompaniesExpanded,
    analysisSummary,
    headerSubtitle,
    hasResults,
    topFacilities,
    dashboardDisabled,
    exportDisabled,
    coloDonut,
    hyperDonut,
    coloTotalMw,
    hyperTotalMw,
    topProvidersWithPipeline,
    topUsersWithPipeline,
    colocationMetrics,
    hyperscaleMetrics,
    readFacilityCode,
    selectFacility,
    tabClass,
    setActiveTab,
    toggleMinimized,
  } = useScannerPanelModel(props as ScannerPanelProps, emit);

  const facilitiesListRef = ref<HTMLElement | null>(null);
  const { animate: staggerFacilities } = useGsapStagger({
    container: facilitiesListRef,
    selector: "button",
    stagger: 0.025,
    duration: 0.25,
    from: { opacity: 0, y: 8 },
  });

  const overviewRef = ref<HTMLElement | null>(null);
  const { animate: staggerOverview } = useGsapStagger({
    container: overviewRef,
    selector: ":scope > *",
    stagger: 0.04,
    duration: 0.25,
    from: { opacity: 0, y: 10 },
  });

  watch(activeTab, (tab) => {
    nextTick(() => {
      if (tab === "facilities") {
        staggerFacilities();
      }
      if (tab === "overview") {
        staggerOverview();
      }
    });
  });
</script>

<template>
  <aside
    class="pointer-events-auto absolute bottom-4 right-3 z-20 flex w-[min(380px,calc(100vw-2rem))] max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card font-sans shadow-md"
    aria-label="Map Summary"
  >
    <div v-if="minimized" class="flex items-center justify-between px-4 py-3">
      <span class="text-sm font-semibold text-foreground/85">Map Select</span>
      <div class="flex items-center gap-1">
        <button
          type="button"
          aria-label="Maximize"
          class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none hover:bg-muted hover:text-foreground/70"
          @click="toggleMinimized()"
        >
          <Maximize2 class="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Close"
          class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none hover:bg-muted hover:text-foreground/70"
          @click="emit('close')"
        >
          <X class="size-3.5" />
        </button>
      </div>
    </div>

    <div v-else class="flex flex-col gap-4 p-4">
      <header>
        <div class="mb-2 flex items-start justify-between">
          <div class="flex items-baseline gap-2">
            <span class="text-sm font-semibold text-foreground/85">Map Summary</span>
            <span class="text-xs text-muted-foreground">{{ headerSubtitle }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              aria-label="Minimize"
              class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none hover:bg-muted hover:text-foreground/70"
              @click="toggleMinimized()"
            >
              <Minus class="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Close"
              class="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none hover:bg-muted hover:text-foreground/70"
              @click="emit('close')"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>

        <nav
          class="flex items-end gap-1 border-b border-border"
          role="tablist"
          aria-label="Scanner tabs"
        >
          <button
            v-for="tab in (['overview', 'colocation', 'hyperscale', 'facilities'] as const)"
            :key="tab"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab"
            class="border-b-2 px-3 pb-2 pt-1 text-xs leading-none transition-colors capitalize focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
            :class="tabClass(tab)"
            @click="setActiveTab(tab)"
          >
            {{ tab }}
          </button>
        </nav>
      </header>

      <p
        v-if="props.parcelsErrorMessage"
        class="rounded border border-[var(--error)]/20 bg-[var(--error)]/5 px-3 py-2 text-xs text-[var(--error)]"
      >
        {{ props.parcelsErrorMessage }}
      </p>

      <section
        v-if="!hasResults"
        class="flex-1 rounded border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground"
      >
        {{ props.emptyMessage ?? "No facilities or parcels in this viewport." }}
      </section>

      <section
        v-else-if="activeTab === 'overview'"
        ref="overviewRef"
        role="tabpanel"
        aria-label="Overview"
        class="flex flex-col gap-4 overflow-auto"
      >
        <div class="flex gap-6">
          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-semibold text-colocation">Colocation</div>
              <div class="text-xs text-muted-foreground">
                {{ analysisSummary.colocation.count }}
                Facilities &bull;
                {{ analysisSummary.topColocationProviders.length }}
                Providers
              </div>
            </div>
            <div class="relative size-[100px]">
              <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke="var(--muted)"
                  stroke-width="12"
                />
                <template v-for="(seg, i) in coloDonut" :key="`colo-${String(i)}`">
                  <circle
                    v-if="seg.path === null"
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                  <path
                    v-else
                    :d="seg.path"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                </template>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-sm font-semibold tabular-nums text-muted-foreground">
                  {{ formatScannerPowerMw(coloTotalMw) }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <div>
              <div class="text-sm font-semibold text-hyperscale">Hyperscale</div>
              <div class="text-xs text-muted-foreground">
                {{ analysisSummary.hyperscale.count }}
                Facilities &bull;
                {{ analysisSummary.topHyperscaleProviders.length }}
                Users
              </div>
            </div>
            <div class="relative size-[100px]">
              <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="36"
                  fill="none"
                  stroke="var(--muted)"
                  stroke-width="12"
                />
                <template v-for="(seg, i) in hyperDonut" :key="`hyper-${String(i)}`">
                  <circle
                    v-if="seg.path === null"
                    cx="50"
                    cy="50"
                    r="36"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                  <path
                    v-else
                    :d="seg.path"
                    fill="none"
                    :stroke="seg.color"
                    stroke-width="12"
                    stroke-linecap="butt"
                  />
                </template>
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-sm font-semibold tabular-nums text-muted-foreground">
                  {{ formatScannerPowerMw(hyperTotalMw) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <button
            type="button"
            class="flex items-center gap-2 text-left"
            @click="topCompaniesExpanded = !topCompaniesExpanded"
          >
            <span class="text-xs font-semibold text-foreground/85">Top Companies</span>
            <span class="text-xs text-muted-foreground">(By Total Capacity MW)</span>
            <ChevronDown
              class="size-3.5 text-muted-foreground transition-transform"
              :class="{ 'rotate-180': topCompaniesExpanded }"
            />
          </button>

          <div v-if="topCompaniesExpanded" class="mt-3 flex gap-6">
            <div class="flex-1">
              <div class="mb-2 text-xs font-semibold text-colocation">Top Providers</div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="p in topProvidersWithPipeline"
                  :key="p.providerName"
                  class="text-xs leading-[1.4]"
                >
                  <div class="font-medium text-colocation">{{ p.providerName }}</div>
                  <div class="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>Comm./Own. {{ formatScannerPowerMw(p.commissionedPowerMw) }}</span>
                    <span>Pipeline {{ formatScannerPowerMw(p.pipelinePowerMw) }}</span>
                    <span>Facilities: {{ p.count }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex-1">
              <div class="mb-2 text-xs font-semibold text-hyperscale">Top Users</div>
              <div class="flex flex-col gap-2">
                <div
                  v-for="p in topUsersWithPipeline"
                  :key="p.providerName"
                  class="text-xs leading-[1.4]"
                >
                  <div class="font-medium text-hyperscale">{{ p.providerName }}</div>
                  <div class="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>Comm./Own. {{ formatScannerPowerMw(p.commissionedPowerMw) }}</span>
                    <span>Pipeline {{ formatScannerPowerMw(p.pipelinePowerMw) }}</span>
                    <span>Facilities: {{ p.count }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        v-else-if="activeTab === 'colocation'"
        role="tabpanel"
        aria-label="Colocation"
        class="flex flex-col gap-2 overflow-auto"
      >
        <div class="mb-1">
          <div class="text-sm font-semibold text-colocation">Colocation</div>
          <div class="text-xs text-muted-foreground">
            {{ analysisSummary.colocation.count }}
            Facilities &bull;
            {{ analysisSummary.topColocationProviders.length }}
            Providers
          </div>
        </div>
        <div
          v-for="row in colocationMetrics"
          :key="row.label"
          class="flex items-center justify-between gap-2 py-1"
          :class="row.value === '' ? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground' : 'text-xs text-muted-foreground'"
        >
          <span>{{ row.label }}</span>
          <ChevronDown v-if="row.value === ''" class="size-3.5" />
          <span v-else class="text-sm font-semibold tabular-nums text-foreground/85"
            >{{ row.value }}</span
          >
        </div>
      </section>

      <section
        v-else-if="activeTab === 'hyperscale'"
        role="tabpanel"
        aria-label="Hyperscale"
        class="flex flex-col gap-2 overflow-auto"
      >
        <div class="mb-1">
          <div class="text-sm font-semibold text-hyperscale">Hyperscale</div>
          <div class="text-xs text-muted-foreground">
            {{ analysisSummary.hyperscale.count }}
            Facilities &bull;
            {{ analysisSummary.topHyperscaleProviders.length }}
            Users
          </div>
        </div>
        <div
          v-for="row in hyperscaleMetrics"
          :key="row.label"
          class="flex items-center justify-between gap-2 py-1"
          :class="row.value === '' ? 'text-xs font-semibold uppercase tracking-wide text-muted-foreground' : 'text-xs text-muted-foreground'"
        >
          <span>{{ row.label }}</span>
          <ChevronDown v-if="row.value === ''" class="size-3.5" />
          <span v-else class="text-sm font-semibold tabular-nums text-foreground/85"
            >{{ row.value }}</span
          >
        </div>
      </section>

      <section
        v-else
        ref="facilitiesListRef"
        role="tabpanel"
        aria-label="Facilities"
        class="flex-1 overflow-auto"
      >
        <div
          class="grid grid-cols-[auto_1fr_68px_52px_52px] gap-x-2 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
        >
          <span>Code</span>
          <span>Company</span>
          <span class="text-right">Com./Own.</span>
          <span class="text-right">UC</span>
          <span class="text-right">Plan.</span>
        </div>

        <button
          v-for="facility in topFacilities"
          :key="facility.facilityId"
          type="button"
          class="grid w-full grid-cols-[auto_1fr_68px_52px_52px] gap-x-2 border-b border-muted py-1.5 text-left text-xs leading-snug transition-colors hover:bg-muted/50 whitespace-nowrap"
          @click="selectFacility(facility)"
        >
          <span class="min-w-0 flex items-center gap-1.5">
            <span
              class="inline-block h-2 w-2 flex-shrink-0 rounded-full"
              :class="{
                'bg-colocation': facility.perspective === 'colocation',
                'bg-hyperscale': facility.perspective === 'hyperscale',
              }"
            />
            <span class="truncate text-foreground/85">{{ readFacilityCode(facility) ?? "" }}</span>
          </span>
          <span
            class="truncate text-muted-foreground"
            :title="facility.providerName ?? undefined"
          >
            {{ facility.providerName ?? "\u2014" }}
          </span>
          <span class="text-right text-muted-foreground">
            {{ facility.commissionedPowerMw === null ? "\u2014" : facility.commissionedPowerMw.toFixed(1) }}
          </span>
          <span class="text-right text-muted-foreground">
            {{ facility.underConstructionPowerMw === null ? "\u2014" : facility.underConstructionPowerMw.toFixed(1) }}
          </span>
          <span class="text-right text-muted-foreground">
            {{ facility.plannedPowerMw === null ? "\u2014" : facility.plannedPowerMw.toFixed(1) }}
          </span>
        </button>
      </section>

      <footer class="flex items-center gap-2">
        <Button
          variant="glass-active"
          size="sm"
          class="flex-1 gap-1.5 rounded-md bg-[#2563eb] text-white hover:bg-[#2563eb]/90"
          :disabled="dashboardDisabled"
          @click="emit('open-dashboard')"
        >
          Open Dashboard
          <ArrowRight class="size-3.5" />
        </Button>
        <Button
          variant="glass"
          size="sm"
          class="flex-1 gap-1.5 rounded-md bg-[#2563eb] text-white hover:bg-[#2563eb]/90"
          :disabled="exportDisabled"
          @click="emit('export')"
        >
          <Download class="size-3.5" />
          Export Facilities
        </Button>
      </footer>
    </div>
  </aside>
</template>
