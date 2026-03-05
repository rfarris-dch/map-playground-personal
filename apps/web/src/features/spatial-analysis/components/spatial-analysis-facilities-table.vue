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

  function selectFacility(facility: SpatialAnalysisFacilityRecord): void {
    emit("select-facility", {
      facilityId: facility.facilityId,
      perspective: facility.perspective,
    });
  }
</script>

<template>
  <table class="w-full border-collapse text-[11px]">
    <thead class="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
      <tr
        class="border-b border-border/60 text-left text-[10px] uppercase tracking-wide text-muted-foreground"
      >
        <th class="px-2 py-1.5">{{ useBadgePerspective ? "Perspective" : "" }}</th>
        <th class="px-2 py-1.5">Facility</th>
        <th class="px-2 py-1.5">Provider</th>
        <th class="px-2 py-1.5 text-right">{{ props.powerHeading ?? "Commissioned" }}</th>
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
        class="cursor-pointer border-b border-border/40 align-top transition hover:bg-muted/20"
        @click="selectFacility(facility)"
      >
        <td class="px-2 py-1.5">
          <span
            v-if="useBadgePerspective"
            class="inline-flex rounded-full px-1.5 py-0.5 text-[10px]"
            :class="facility.perspective === 'colocation'
              ? 'bg-cyan-500/10 text-cyan-700'
              : 'bg-amber-500/10 text-amber-700'"
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
            class="w-full truncate text-left font-medium text-foreground/90 underline-offset-2 transition hover:text-foreground hover:underline"
            @click.stop="selectFacility(facility)"
          >
            {{ facility.facilityName }}
          </button>
        </td>
        <td class="max-w-[14rem] px-2 py-1.5">
          <div class="truncate">{{ facility.providerName }}</div>
        </td>
        <td class="px-2 py-1.5 text-right font-medium">
          {{ props.formatPower(facility.commissionedPowerMw) }}
        </td>
        <td class="px-2 py-1.5">
          {{ toSpatialAnalysisSemanticLabel(facility.commissionedSemantic) }}
        </td>
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
