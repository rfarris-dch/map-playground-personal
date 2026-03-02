import type { FacilityPerspective } from "@map-migration/contracts";
import { useQuery } from "@tanstack/vue-query";
import { computed, type Ref } from "vue";
import { fetchFacilityDetail } from "./detail.api";
import { unwrapFacilityDetailResult } from "./detail.service";
import type { SelectedFacilityRef } from "../facilities.types";

type FacilityDetailQueryKey = readonly [
  "facility-detail",
  FacilityPerspective | null,
  string | null,
];

function isFacilityPerspective(value: unknown): value is FacilityPerspective {
  return value === "colocation" || value === "hyperscale";
}

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
      const perspective = activeQueryKey[1];
      const facilityId = activeQueryKey[2];
      if (!isFacilityPerspective(perspective) || typeof facilityId !== "string") {
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
