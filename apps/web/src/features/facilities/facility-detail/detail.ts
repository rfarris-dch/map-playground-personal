import { parseFacilityPerspective } from "@map-migration/contracts";
import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";
import { fetchFacilityDetail } from "@/features/facilities/facility-detail/detail.api";
import { unwrapFacilityDetailResult } from "@/features/facilities/facility-detail/detail.service";
import type { FacilityDetailQueryKey } from "./detail.types";

function buildFacilityDetailQueryKey(
  selectedFacility: SelectedFacilityRef | null
): FacilityDetailQueryKey {
  if (selectedFacility === null) {
    return ["facility-detail", null, null];
  }

  return ["facility-detail", selectedFacility.perspective, selectedFacility.facilityId];
}

export function useFacilityDetailQuery(selectedFacility: Ref<SelectedFacilityRef | null>) {
  const queryKey = computed(() => buildFacilityDetailQueryKey(selectedFacility.value));
  const enabled = computed(() => selectedFacility.value !== null);

  return useQuery({
    queryKey,
    queryFn: async ({ signal, queryKey: activeQueryKey }) => {
      const perspective = parseFacilityPerspective(activeQueryKey[1]);
      const facilityId = activeQueryKey[2];
      if (perspective === null || typeof facilityId !== "string") {
        throw new Error("facility id is required");
      }

      const result = await fetchFacilityDetail({
        perspective,
        facilityId,
        signal,
      });
      return unwrapFacilityDetailResult(result);
    },
    enabled,
  });
}
