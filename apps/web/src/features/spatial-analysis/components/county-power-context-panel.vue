<script setup lang="ts">
  import type { CountyScore } from "@map-migration/http-contracts/county-intelligence-http";
  import type { SpatialAnalysisCountyScores } from "@map-migration/http-contracts/spatial-analysis-summary-http";
  import {
    formatBooleanPresence,
    formatCompetitiveAreaType,
    formatCount,
    formatFeatureFamily,
    formatMarketStructure,
    formatMetric,
    formatNullableText,
    formatRetailChoiceStatus,
    formatShare,
  } from "@/features/county-intelligence/county-intelligence-display.service";

  interface CountyPowerContextPanelProps {
    readonly row: CountyScore | SpatialAnalysisCountyScores["rows"][number];
  }

  const props = defineProps<CountyPowerContextPanelProps>();

  function utilityLabel(
    utility:
      | CountyScore["retailStructure"]["utilityContext"]["utilities"][number]
      | SpatialAnalysisCountyScores["rows"][number]["retailStructure"]["utilityContext"]["utilities"][number]
  ): string {
    const utilityName = formatNullableText(utility.utilityName);
    const territoryType = formatNullableText(utility.territoryType);
    const retailChoiceStatus = formatRetailChoiceStatus(utility.retailChoiceStatus);

    return `${utilityName} · ${territoryType} · ${retailChoiceStatus}`;
  }

  function formatOptionalCodeLabel(value: string | null | undefined): string {
    return typeof value === "string" && value.trim().length > 0 ? formatFeatureFamily(value) : "-";
  }

  function sourceProvenanceEntries(row: CountyScore | SpatialAnalysisCountyScores["rows"][number]) {
    const entries = [
      {
        label: "Wholesale markets",
        value: row.sourceProvenance.wholesaleMarkets,
      },
      {
        label: "Operating footprints",
        value: row.sourceProvenance.operatingFootprints,
      },
      {
        label: "Retail structure",
        value: row.sourceProvenance.retailStructure,
      },
      {
        label: "Utility territories",
        value: row.sourceProvenance.utilityTerritories,
      },
      {
        label: "Transmission",
        value: row.sourceProvenance.transmission,
      },
      {
        label: "Interconnection queue",
        value: row.sourceProvenance.interconnectionQueue,
      },
      {
        label: "Congestion",
        value: row.sourceProvenance.congestion,
      },
    ];

    return entries.filter((entry) => entry.value !== null);
  }
</script>

<template>
  <div class="context-grid grid grid-cols-2 gap-x-4 gap-y-5 text-xs">
    <div class="context-section">
      <div class="context-heading">Wholesale + Footprint</div>
      <dl class="context-dl">
        <dt>Operator</dt>
        <dd>{{ formatNullableText(props.row.powerMarketContext.wholesaleOperator) }}</dd>
        <dt>Structure</dt>
        <dd>{{ formatMarketStructure(props.row.powerMarketContext.marketStructure) }}</dd>
        <dt>Balancing auth.</dt>
        <dd>{{ formatNullableText(props.row.powerMarketContext.balancingAuthority) }}</dd>
        <dt>Zone</dt>
        <dd>{{ formatNullableText(props.row.powerMarketContext.operatorZoneLabel) }}</dd>
        <dt>Zone type</dt>
        <dd>{{ formatOptionalCodeLabel(props.row.powerMarketContext.operatorZoneType) }}</dd>
        <dt>Zone confidence</dt>
        <dd>{{ formatOptionalCodeLabel(props.row.powerMarketContext.operatorZoneConfidence) }}</dd>
        <dt>Weather zone</dt>
        <dd>{{ formatNullableText(props.row.powerMarketContext.operatorWeatherZone) }}</dd>
        <dt>Meteo zone</dt>
        <dd>{{ formatNullableText(props.row.powerMarketContext.meteoZone) }}</dd>
        <dt>Primary market</dt>
        <dd>{{ formatNullableText(props.row.primaryMarketId) }}</dd>
        <dt>Seam county</dt>
        <dd>
          {{ formatBooleanPresence(props.row.isSeamCounty, {
            trueLabel: "Yes",
            falseLabel: "No",
          }) }}
        </dd>
      </dl>
    </div>

    <div class="context-section">
      <div class="context-heading">Retail + Utility</div>
      <dl class="context-dl">
        <dt>Retail choice</dt>
        <dd>{{ formatRetailChoiceStatus(props.row.retailStructure.retailChoiceStatus) }}</dd>
        <dt>Area type</dt>
        <dd>{{ formatCompetitiveAreaType(props.row.retailStructure.competitiveAreaType) }}</dd>
        <dt>Primary TDU</dt>
        <dd>{{ formatNullableText(props.row.retailStructure.primaryTduOrUtility) }}</dd>
        <dt>Choice penetration</dt>
        <dd>
          {{ formatShare(props.row.retailStructure.utilityContext.retailChoicePenetrationShare) }}
        </dd>
        <dt>Dominant utility</dt>
        <dd>
          {{ formatNullableText(props.row.retailStructure.utilityContext.dominantUtilityName) }}
        </dd>
        <dt>Territory type</dt>
        <dd>{{ formatNullableText(props.row.retailStructure.utilityContext.territoryType) }}</dd>
        <dt>Utility count</dt>
        <dd>{{ formatCount(props.row.retailStructure.utilityContext.utilityCount) }}</dd>
      </dl>
      <div
        v-if="props.row.retailStructure.utilityContext.utilities.length > 0"
        class="mt-2 space-y-1 border-t border-border/30 pt-2"
      >
        <div
          v-for="utility in props.row.retailStructure.utilityContext.utilities"
          :key="`${utility.utilityId ?? utility.utilityName ?? 'utility'}-${utility.retailChoiceStatus}`"
          class="text-[11px] text-foreground/60"
        >
          {{ utilityLabel(utility) }}
        </div>
      </div>
    </div>

    <div class="context-section">
      <div class="context-heading">Infrastructure + Queue</div>
      <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Transmission (mi)
      </div>
      <dl class="context-dl mb-2">
        <dt>69 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles69kvPlus) }}
        </dd>
        <dt>138 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles138kvPlus) }}
        </dd>
        <dt>230 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles230kvPlus) }}
        </dd>
        <dt>345 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles345kvPlus) }}
        </dd>
        <dt>500 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles500kvPlus) }}
        </dd>
        <dt>765 kV+</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.transmissionContext.miles765kvPlus) }}
        </dd>
      </dl>
      <dl class="context-dl">
        <dt>Gas pipeline</dt>
        <dd>
          {{ formatBooleanPresence(props.row.gasPipelinePresenceFlag, {
            trueLabel: "Present",
            falseLabel: "Not observed",
          }) }}
        </dd>
        <dt>Gas mileage</dt>
        <dd class="tabular-nums">{{ formatMetric(props.row.gasPipelineMileageCounty) }}</dd>
        <dt>Fiber</dt>
        <dd>
          {{ formatBooleanPresence(props.row.fiberPresenceFlag, {
            trueLabel: "Present",
            falseLabel: "Not observed",
          }) }}
        </dd>
      </dl>
      <div class="mt-2 border-t border-border/30 pt-2">
        <div
          class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          Interconnection Queue
        </div>
        <dl class="context-dl">
          <dt>Active MW</dt>
          <dd class="tabular-nums">{{ formatMetric(props.row.interconnectionQueue.activeMw) }}</dd>
          <dt>Projects</dt>
          <dd class="tabular-nums">
            {{ formatCount(props.row.interconnectionQueue.projectCountActive) }}
          </dd>
          <dt>Storage MW</dt>
          <dd class="tabular-nums">{{ formatMetric(props.row.interconnectionQueue.storageMw) }}</dd>
          <dt>Solar MW</dt>
          <dd class="tabular-nums">{{ formatMetric(props.row.interconnectionQueue.solarMw) }}</dd>
          <dt>Wind MW</dt>
          <dd class="tabular-nums">{{ formatMetric(props.row.interconnectionQueue.windMw) }}</dd>
          <dt>Avg age (days)</dt>
          <dd class="tabular-nums">
            {{ formatMetric(props.row.interconnectionQueue.avgAgeDays, 0) }}
          </dd>
          <dt>Withdrawal rate</dt>
          <dd class="tabular-nums">
            {{ formatShare(props.row.interconnectionQueue.withdrawalRate) }}
          </dd>
          <dt>Recent online MW</dt>
          <dd class="tabular-nums">
            {{ formatMetric(props.row.interconnectionQueue.recentOnlineMw) }}
          </dd>
        </dl>
      </div>
    </div>

    <div class="context-section">
      <div class="context-heading">Congestion + Provenance</div>
      <dl class="context-dl">
        <dt>Proxy score</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.congestionContext.congestionProxyScore) }}
        </dd>
        <dt>Avg RT congestion</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.congestionContext.avgRtCongestionComponent, 2) }}
        </dd>
        <dt>P95 shadow</dt>
        <dd class="tabular-nums">
          {{ formatMetric(props.row.congestionContext.p95ShadowPrice, 2) }}
        </dd>
        <dt>Neg. price hrs</dt>
        <dd class="tabular-nums">
          {{ formatShare(props.row.congestionContext.negativePriceHourShare) }}
        </dd>
      </dl>

      <div
        v-if="props.row.congestionContext.topConstraints.length > 0"
        class="mt-2 border-t border-border/30 pt-2"
      >
        <div
          class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          Top Constraints
        </div>
        <dl class="context-dl">
          <template
            v-for="constraint in props.row.congestionContext.topConstraints"
            :key="constraint.constraintId"
          >
            <dt class="truncate" :title="constraint.label">{{ constraint.label }}</dt>
            <dd class="tabular-nums">{{ formatMetric(constraint.shadowPrice, 2) }}</dd>
          </template>
        </dl>
      </div>

      <div class="mt-2 border-t border-border/30 pt-2">
        <div
          class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
        >
          Provenance
        </div>
        <dl class="context-dl">
          <dt>Run</dt>
          <dd class="truncate" :title="props.row.publicationRunId ?? undefined">
            {{ formatNullableText(props.row.publicationRunId) }}
          </dd>
          <dt>Formula</dt>
          <dd>{{ formatNullableText(props.row.formulaVersion) }}</dd>
          <dt>Input data</dt>
          <dd>{{ formatNullableText(props.row.inputDataVersion) }}</dd>
        </dl>
        <dl v-if="sourceProvenanceEntries(props.row).length > 0" class="context-dl mt-1">
          <template v-for="entry in sourceProvenanceEntries(props.row)" :key="entry.label">
            <dt>{{ entry.label }}</dt>
            <dd class="truncate" :title="formatNullableText(entry.value) ?? undefined">
              {{ formatNullableText(entry.value) }}
            </dd>
          </template>
        </dl>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .context-heading {
    padding-bottom: 0.375rem;
    margin-bottom: 0.5rem;
    font-size: 10px;
    font-weight: 700;
    color: var(--muted-foreground);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }

  .context-dl {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.125rem 0.5rem;
    margin: 0;
  }

  .context-dl dt {
    color: var(--muted-foreground);
    white-space: nowrap;
  }

  .context-dl dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.65);
    text-align: right;
    white-space: nowrap;
  }
</style>
