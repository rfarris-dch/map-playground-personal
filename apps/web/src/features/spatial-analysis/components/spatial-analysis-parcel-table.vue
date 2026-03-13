<script setup lang="ts">
  import { computed, shallowRef, watch } from "vue";
  import Button from "@/components/ui/button/button.vue";
  import {
    SPATIAL_ANALYSIS_PARCEL_FOCUS_FIELDS,
    spatialAnalysisParcelFieldValue,
  } from "@/features/spatial-analysis/spatial-analysis-parcels.service";
  import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";

  interface SpatialAnalysisParcelTableProps {
    readonly parcels: readonly SpatialAnalysisParcelRecord[];
    readonly rowsPerPage?: number;
  }

  const props = defineProps<SpatialAnalysisParcelTableProps>();

  const page = shallowRef<number>(1);
  const effectiveRowsPerPage = computed(() => {
    const configuredValue = props.rowsPerPage;
    if (typeof configuredValue !== "number" || !Number.isFinite(configuredValue)) {
      return 200;
    }

    return Math.max(1, Math.floor(configuredValue));
  });

  const pageCount = computed(() =>
    Math.max(1, Math.ceil(props.parcels.length / effectiveRowsPerPage.value))
  );

  const pageStartIndex = computed(() => (page.value - 1) * effectiveRowsPerPage.value);

  const pagedParcels = computed(() =>
    props.parcels.slice(pageStartIndex.value, pageStartIndex.value + effectiveRowsPerPage.value)
  );

  const pageEndIndex = computed(() =>
    Math.min(pageStartIndex.value + pagedParcels.value.length, props.parcels.length)
  );

  watch(
    () => props.parcels,
    () => {
      if (page.value < 1) {
        page.value = 1;
        return;
      }

      if (page.value > pageCount.value) {
        page.value = pageCount.value;
      }
    }
  );

  function showPreviousPage(): void {
    if (page.value <= 1) {
      return;
    }

    page.value -= 1;
  }

  function showNextPage(): void {
    if (page.value >= pageCount.value) {
      return;
    }

    page.value += 1;
  }
</script>

<template>
  <div
    class="flex items-center justify-between border-b border-[#E2E8F0] px-2 py-1 text-[10px] text-[#94A3B8]"
  >
    <p class="m-0">
      Showing {{ pageStartIndex + 1 }}-{{ pageEndIndex }}
      of {{ props.parcels.length }}
    </p>
    <div class="flex items-center gap-1">
      <Button
        size="sm"
        variant="glass"
        class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
        :disabled="page <= 1"
        @click="showPreviousPage"
      >
        Prev
      </Button>
      <span class="font-mono">Page {{ page }} / {{ pageCount }}</span>
      <Button
        size="sm"
        variant="glass"
        class="h-[22px] rounded-[4px] border border-[#E2E8F0] bg-white px-2 text-[10px] font-normal text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#64748B]"
        :disabled="page >= pageCount"
        @click="showNextPage"
      >
        Next
      </Button>
    </div>
  </div>
  <table class="min-w-max text-[10px] text-[#94A3B8]">
    <thead>
      <tr
        class="sticky top-0 border-b border-[#E2E8F0] bg-white text-[10px] uppercase tracking-wide text-[#94A3B8] shadow-[0_1px_2px_rgba(15,23,42,0.04)] whitespace-nowrap"
      >
        <th class="px-2 py-1 text-left">parcel_id</th>
        <th
          v-for="field in SPATIAL_ANALYSIS_PARCEL_FOCUS_FIELDS"
          :key="`field-${field}`"
          class="px-2 py-1 text-left"
        >
          {{ field }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="parcel in pagedParcels"
        :key="parcel.parcelId"
        class="border-t border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
      >
        <td class="px-2 py-1 text-[10px] text-[#94A3B8]">{{ parcel.parcelId }}</td>
        <td
          v-for="field in SPATIAL_ANALYSIS_PARCEL_FOCUS_FIELDS"
          :key="`${parcel.parcelId}-${field}`"
          class="px-2 py-1"
        >
          {{ spatialAnalysisParcelFieldValue(parcel, field) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
