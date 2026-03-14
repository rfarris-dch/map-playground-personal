import { parseFacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import { computed, type Ref } from "vue";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { fetchFacilityDetail } from "@/features/facilities/facility-detail/detail.api";
import { unwrapFacilityDetailResult } from "@/features/facilities/facility-detail/detail.service";
import { createEntityDetailQuery } from "@/lib/api/entity-detail-query.service";
import type { FacilityDetailQueryKey } from "./detail.types";

function buildFacilityDetailQueryKey(
  selectedFacility: SelectedFacilityRef | null,
  selectionNonce: number
): FacilityDetailQueryKey {
  if (selectedFacility === null) {
    return ["facility-detail", null, null, selectionNonce];
  }

  return [
    "facility-detail",
    selectedFacility.perspective,
    selectedFacility.facilityId,
    selectionNonce,
  ];
}

export function useFacilityDetailQuery(
  selectedFacility: Ref<SelectedFacilityRef | null>,
  selectionNonce: Ref<number>
) {
  const selectedFacilityWithNonce = computed(() => ({
    selectedFacility: selectedFacility.value,
    selectionNonce: selectionNonce.value,
  }));

  return createEntityDetailQuery({
    buildQueryKey({ selectedFacility: nextSelectedFacility, selectionNonce: nextSelectionNonce }) {
      return buildFacilityDetailQueryKey(nextSelectedFacility, nextSelectionNonce);
    },
    isEnabled({ selectedFacility: nextSelectedFacility }) {
      return nextSelectedFacility !== null;
    },
    query: async ({ queryKey, signal }) => {
      const perspective = parseFacilityPerspective(queryKey[1]);
      const facilityId = queryKey[2];
      if (perspective === null || typeof facilityId !== "string") {
        throw new Error("facility id is required");
      }

      return unwrapFacilityDetailResult(
        await fetchFacilityDetail({
          facilityId,
          perspective,
          signal,
        })
      );
    },
    selected: selectedFacilityWithNonce,
  });
}
