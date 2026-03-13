<script setup lang="ts">
  import { computed } from "vue";
  import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
  import {
    toSpatialAnalysisCoordinateText,
    toSpatialAnalysisPerspectiveLabel,
    toSpatialAnalysisSemanticLabel,
  } from "@/features/spatial-analysis/spatial-analysis-facilities.service";
  import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";

  interface SpatialAnalysisFacilitiesTableProps {
    readonly facilities: readonly SpatialAnalysisFacilityRecord[];
    readonly formatPower: (powerMw: number | null) => string;
    readonly interactive?: boolean;
    readonly leaseSemantic?: boolean;
    readonly perspectiveDisplay?: "badge" | "dot";
    readonly powerHeading?: string;
    readonly showCoordinates?: boolean;
  }

  const props = defineProps<SpatialAnalysisFacilitiesTableProps>();
  const emit = defineEmits<{
    "select-facility": [facility: SelectedFacilityRef];
  }>();

  const useBadgePerspective = computed(() => props.perspectiveDisplay === "badge");
  const isInteractive = computed(() => props.interactive !== false);
  const useSemanticLease = computed(() => props.leaseSemantic !== false);
  const displayCoordinates = computed(() => props.showCoordinates === true);

  function leaseOrOwnText(value: SpatialAnalysisFacilityRecord["leaseOrOwn"]): string {
    if (value === null) {
      return "-";
    }

    if (!useSemanticLease.value) {
      return value;
    }

    return toSpatialAnalysisSemanticLabel(value);
  }

  function locationText(facility: SpatialAnalysisFacilityRecord): string {
    const parts = [facility.city, facility.state ?? facility.stateAbbrev].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
    if (parts.length > 0) {
      return parts.join(", ");
    }

    if (typeof facility.address === "string" && facility.address.trim().length > 0) {
      return facility.address;
    }

    return "-";
  }

  function pipelinePowerMw(facility: SpatialAnalysisFacilityRecord): number {
    return (facility.plannedPowerMw ?? 0) + (facility.underConstructionPowerMw ?? 0);
  }

  function squareFootageText(value: number | null): string {
    if (value === null || !Number.isFinite(value) || value <= 0) {
      return "-";
    }

    return Math.round(value).toLocaleString();
  }

  function statusText(facility: SpatialAnalysisFacilityRecord): string {
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
</script>

<template>
  <table class="w-full min-w-[640px] border-collapse text-xs text-muted-foreground">
    <thead
      class="sticky top-0 z-10 border-b border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <tr class="text-left text-xs uppercase tracking-wide text-muted-foreground">
        <th class="px-2 py-1.5">{{ useBadgePerspective ? "Perspective" : "" }}</th>
        <th class="px-2 py-1.5">Facility</th>
        <th class="px-2 py-1.5">Provider</th>
        <th class="px-2 py-1.5">Location</th>
        <th class="px-2 py-1.5 text-right">{{ props.powerHeading ?? "Commissioned" }}</th>
        <th class="px-2 py-1.5 text-right">Pipeline</th>
        <th class="px-2 py-1.5 text-right">Square Ft</th>
        <th class="px-2 py-1.5">Status</th>
        <th class="px-2 py-1.5">Lease/Own</th>
        <th v-if="displayCoordinates" class="px-2 py-1.5 text-right">Lng</th>
        <th v-if="displayCoordinates" class="px-2 py-1.5 text-right">Lat</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="facility in props.facilities"
        :key="`${facility.perspective}:${facility.facilityId}`"
        class="border-b border-border align-top transition-colors"
        :class="isInteractive ? 'cursor-pointer hover:bg-background' : ''"
        @click="isInteractive ? selectFacility(facility) : undefined"
      >
        <td class="px-2 py-1.5">
          <span
            v-if="useBadgePerspective"
            class="inline-flex rounded-sm border border-border px-1.5 py-0.5 text-xs"
            :class="facility.perspective === 'colocation'
              ? 'bg-white text-muted-foreground'
              : 'bg-white text-muted-foreground'"
          >
            {{ toSpatialAnalysisPerspectiveLabel(facility.perspective) }}
          </span>
          <span
            v-else
            class="inline-block h-2 w-2 rounded-full"
            :class="facility.perspective === 'colocation' ? 'bg-cyan-500' : 'bg-amber-500'"
            :title="toSpatialAnalysisPerspectiveLabel(facility.perspective)"
          />
        </td>
        <td class="max-w-[18rem] px-2 py-1.5">
          <button
            type="button"
            class="w-full truncate text-left font-medium text-foreground/70"
            :class="isInteractive ? 'underline-offset-2 transition hover:text-foreground/75 hover:underline' : 'cursor-default'"
            :disabled="!isInteractive"
            @click.stop="isInteractive ? selectFacility(facility) : undefined"
          >
            {{ facility.facilityName }}
          </button>
        </td>
        <td class="max-w-[14rem] px-2 py-1.5">
          <div class="truncate">{{ facility.providerName }}</div>
        </td>
        <td class="max-w-[14rem] px-2 py-1.5">
          <div class="truncate">{{ locationText(facility) }}</div>
        </td>
        <td class="px-2 py-1.5 text-right font-medium">
          {{ props.formatPower(facility.commissionedPowerMw) }}
        </td>
        <td class="px-2 py-1.5 text-right font-medium">
          {{ props.formatPower(pipelinePowerMw(facility)) }}
        </td>
        <td class="px-2 py-1.5 text-right font-medium">
          {{ squareFootageText(facility.squareFootage) }}
        </td>
        <td class="px-2 py-1.5">{{ statusText(facility) }}</td>
        <td class="px-2 py-1.5">{{ leaseOrOwnText(facility.leaseOrOwn) }}</td>
        <td v-if="displayCoordinates" class="px-2 py-1.5 text-right font-mono">
          {{ toSpatialAnalysisCoordinateText(facility.coordinates[0]) }}
        </td>
        <td v-if="displayCoordinates" class="px-2 py-1.5 text-right font-mono">
          {{ toSpatialAnalysisCoordinateText(facility.coordinates[1]) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
